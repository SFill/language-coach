import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchWordlists,
  createWordlist,
  updateWordlist,
  deleteWordlist,
  updateWordListsBeforeRefresh
} from '../api';
import { normalizePhrase, areCloseMatches } from './utils';
import { SyncCoordinator } from '../sync/SyncCoordinator';

// Create the context
const WordlistContext = createContext();

// LocalStorage key for language preference
const LANGUAGE_STORAGE_KEY = 'language_preference';

// Ensure every word has a stable id and version. Legacy/corrupted data stored
// before these fields existed lacks them, so synthesize on load.
const normalizeWord = (w) => ({
  ...w,
  id: w.id ?? crypto.randomUUID(),
  version: w.version ?? 0,
});

// A list is marked dirty when any word still needs its translations generated
// (e.g. cleansed legacy data with null translations). The next sync flushes it
// and the backend retranslates from the intact word + example_phrase.
const listNeedsTranslations = (words) =>
  (words || []).some(w => w.word_translation == null);

// Custom hook to use the wordlist context
export function useWordlist() {
  return useContext(WordlistContext);
}

export function WordlistProvider({ children }) {
  // Initialize language from localStorage or default to English
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return savedLanguage || "en";
  });

  // Store all wordlists (both languages)
  const [allWordlists, setAllWordlists] = useState([]);
  
  // Store filtered wordlists for the current language (derived state)
  const [wordlists, setWordlists] = useState([]);
  
  const [loadingWordLists, setLoadingWordLists] = useState(true);
  const [error, setError] = useState(null);
  // Guards concurrent initial fetches (separate from the sync coordinator, which
  // guards dirty-list syncs).
  const loadInProgress = useRef(false);

  // Track which languages we've loaded
  const loadedLanguages = useRef(new Set());

  // Save language preference to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
    
    // Filter wordlists for current language when it changes
    filterWordlistsByLanguage(currentLanguage);
  }, [currentLanguage]);

  // Filter wordlists for the current language
  const filterWordlistsByLanguage = useCallback((language) => {
    const filtered = allWordlists.filter(list => list.language === language);
    setWordlists(filtered);
  }, [allWordlists]);

  // Load wordlists from API - optimized to load all languages
  const loadWordlists = useCallback(async (force = false) => {
    // Prevent multiple simultaneous fetches
    if (loadInProgress.current && !force) return;

    const tasks = [];
    if (!loadedLanguages.current.has('en') || force) tasks.push(['en', fetchWordlists('en')]);
    if (!loadedLanguages.current.has('es') || force) tasks.push(['es', fetchWordlists('es')]);
    // Nothing to fetch (already loaded, not forced) — bail out without toggling
    // the loading flag, otherwise the load effect's re-run on every allWordlists
    // change would flash "Loading..." after every edit.
    if (tasks.length === 0) return;

    loadInProgress.current = true;
    setLoadingWordLists(true);

    try {
      const fetched = Object.fromEntries(
        await Promise.all(tasks.map(async ([lang, p]) => [lang, await p]))
      );

      // Only mutate state when a language was actually fetched, otherwise the
      // new array reference would retrigger the load effect in a loop.
      let next = allWordlistsRef.current;
      let changed = false;
      for (const lang of ['en', 'es']) {
        if (!fetched[lang]) continue;
        changed = true;
        loadedLanguages.current.add(lang);
        const normalized = fetched[lang].map(list => {
          const words = (list.words || []).map(normalizeWord);
          return { ...list, words, _isDirty: listNeedsTranslations(words) };
        });
        // Replace this language's lists, keep the other language's lists.
        next = next.filter(l => l.language !== lang).concat(normalized);
      }

      if (changed) {
        allWordlistsRef.current = next;
        setAllWordlists(next);
        // If the load surfaced lists that still need translations (cleansed legacy
        // data, or a prior failed retranslation), flush now so the backend
        // retranslates them immediately rather than waiting for the 60s tick.
        if (next.some(l => l._isDirty)) {
          syncCoordinatorRef.current?.flush();
        }
      }

      setError(null);
      filterWordlistsByLanguage(currentLanguage);
    } catch (err) {
      console.error('Failed to load wordlists:', err);
      setError('Failed to load word lists. Please try again later.');
    } finally {
      setLoadingWordLists(false);
      loadInProgress.current = false;
    }
  }, [currentLanguage, filterWordlistsByLanguage]);

  // Update filtered wordlists when allWordlists changes
  useEffect(() => {
    filterWordlistsByLanguage(currentLanguage);
  }, [allWordlists, currentLanguage, filterWordlistsByLanguage]);

  // Ref is the imperative source of truth: every mutation updates it
  // synchronously (then mirrors to state for rendering), so the sync
  // coordinator's flush() always reads fresh dirty state with no race.
  const allWordlistsRef = useRef([]);

  // Apply a new allWordlists array: update the ref synchronously, then state.
  const commit = useCallback((next) => {
    allWordlistsRef.current = next;
    setAllWordlists(next);
  }, []);

  // Persist one batch of dirty lists. Translations are sent empty; the backend
  // keeps stored translations for unchanged words (matched by id + version) and
  // regenerates only changed ones. The POST response carries the regenerated
  // translations, which we merge back into local state so the UI updates without
  // a separate refetch. A list whose sync failed stays dirty for the next tick.
  const syncDirtyLists = useCallback(async (dirtyLists) => {
    if (!dirtyLists || dirtyLists.length === 0) return;

    const toPayload = (list) => ({
      name: list.name,
      language: list.language,
      words: list.words.map(w => ({
        id: w.id,
        word: w.word,
        version: w.version,
        example_phrase: w.example_phrase ?? null,
        word_translation: null,
        example_phrase_translation: null,
      })),
    });

    const results = await Promise.all(
      dirtyLists.map(async (list) => ({
        id: list.id,
        updated: await updateWordlist(list.id, toPayload(list)),
      }))
    );
    const updatedByListId = new Map(results.map(r => [r.id, r.updated]));

    const next = allWordlistsRef.current.map(list => {
      const updated = updatedByListId.get(list.id);
      if (!updated) return list; // sync failed → keep dirty for retry
      const freshById = new Map((updated.words || []).map(w => [w.id, w]));
      return {
        ...list,
        name: updated.name ?? list.name,
        _isDirty: false,
        words: list.words.map(w => {
          const fresh = freshById.get(w.id);
          if (!fresh) return { ...w, _isUpdating: false };
          return {
            ...w,
            word: fresh.word ?? w.word,
            example_phrase: fresh.example_phrase ?? w.example_phrase,
            word_translation: fresh.word_translation ?? null,
            example_phrase_translation: fresh.example_phrase_translation ?? null,
            version: fresh.version ?? w.version,
            _isUpdating: false,
          };
        }),
      };
    });
    commit(next);
    console.log(`Synced ${dirtyLists.length} modified wordlists`);
  }, [commit]);

  // Sync coordinator — the shared executor (same class homework uses for draft
  // autosave). Wordlist drives it from a 60s interval + flush on language change;
  // the coordinator owns the in-flight guard and status.
  const syncCoordinatorRef = useRef(null);
  if (!syncCoordinatorRef.current) {
    syncCoordinatorRef.current = new SyncCoordinator({
      delay: 0, // wordlist is interval-driven, not debounced
      getPayload: () => {
        const dirty = allWordlistsRef.current.filter(list => list._isDirty);
        return dirty.length > 0 ? dirty : null;
      },
      persister: syncDirtyLists,
    });
  }
  const syncCoordinator = syncCoordinatorRef.current;

  // Initial load on component mount and set up the periodic dirty-sync interval
  useEffect(() => {
    loadWordlists();
    // Periodic sync of dirty lists every 60s (the coordinator guards concurrency).
    const syncInterval = setInterval(() => syncCoordinator.flush(), 60 * 1000);
    return () => clearInterval(syncInterval);
  }, [loadWordlists, syncCoordinator]);

  // Save wordlists before window unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Sync any pending changes
      const dirtyLists = allWordlistsRef.current.filter(list => list._isDirty);
      if (dirtyLists.length > 0) {
        updateWordListsBeforeRefresh(dirtyLists);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Change the current language - optimized to not refetch since we already have both
  const changeLanguage = useCallback((language) => {
    if (language === currentLanguage) return;

    // Flush any dirty lists before changing language (coordinator guards concurrency).
    syncCoordinator
      .flush()
      .then(() => setCurrentLanguage(language))
      .catch((err) => {
        console.error('Error syncing before language change:', err);
        setCurrentLanguage(language); // Change language anyway
      });
  }, [currentLanguage, syncCoordinator]);

  // Find a word in any list (exact or close match)
  const findWordInLists = useCallback((text) => {
    if (!text || !text.trim()) return null;

    const normalizedText = normalizePhrase(text);

    for (const list of allWordlists) {
      for (const w of list.words) {
        const normalizedExisting = normalizePhrase(w.word);

        // Exact match
        if (normalizedExisting === normalizedText) {
          return {
            matchType: 'exact',
            word: w.word,
            listId: list.id,
            listName: list.name,
            language: list.language
          };
        }

        // Close match
        if (areCloseMatches(normalizedExisting, normalizedText)) {
          return {
            matchType: 'close',
            word: w.word,
            listId: list.id,
            listName: list.name,
            language: list.language
          };
        }
      }
    }

    // No match found
    return null;
  }, [allWordlists]);

  // Add a word to a list with optional sentence context
  const addWordToList = useCallback((word, listId, sentenceContext = null) => {
    if (!word.trim()) return { success: false, message: 'No word provided' };

    // Find if word exists in any list
    const match = findWordInLists(word);
    if (match && match.matchType === 'exact') {
      return {
        success: false,
        message: `Word "${word}" already exists in list "${match.listName}"`,
      };
    }

    // Find the target list
    const targetList = allWordlistsRef.current.find(list => list.id === listId);
    if (!targetList) {
      return { success: false, message: 'List not found' };
    }

    const newWord = {
      id: crypto.randomUUID(),
      word: word.trim(),
      version: 0,
      word_translation: null,
      example_phrase: sentenceContext || null,
      example_phrase_translation: null,
    };
    const next = allWordlistsRef.current.map(list =>
      list.id === listId
        ? { ...list, _isDirty: true, words: [...list.words, newWord] }
        : list
    );
    commit(next);
    syncCoordinatorRef.current?.flush();

    return {
      success: true,
      message: `Added "${word}" to list "${targetList.name}"${sentenceContext ? ' with sentence context' : ''}`,
    };
  }, [commit, findWordInLists]);

  // Edit one field ('word' | 'example_phrase') of a word. Bumps the word's
  // version so the backend retranslates, clears both translations, and shows a
  // spinner until the sync response merges the regenerated translations back.
  const updateWordField = useCallback((wordId, field, listId, value) => {
    const next = allWordlistsRef.current.map(list => {
      if (list.id !== listId) return list;
      const words = list.words.map(w =>
        w.id === wordId
          ? {
              ...w,
              [field]: value.trim(),
              version: (w.version ?? 0) + 1,
              word_translation: null,
              example_phrase_translation: null,
              _isUpdating: true,
            }
          : w
      );
      return { ...list, words, _isDirty: true };
    });
    commit(next);
    syncCoordinatorRef.current?.flush();
    return { success: true, message: `Updated ${field} for word "${value}"` };
  }, [commit]);

  // Move a word from one list to another
  const moveWordBetweenLists = useCallback((wordId, sourceListId, targetListId) => {
    if (!wordId || sourceListId === targetListId) {
      return { success: false, message: 'Invalid operation' };
    }

    const sourceList = allWordlistsRef.current.find(list => list.id === sourceListId);
    const targetList = allWordlistsRef.current.find(list => list.id === targetListId);
    if (!sourceList || !targetList) {
      return { success: false, message: 'One or more lists not found' };
    }

    const wordToMove = sourceList.words.find(w => w.id === wordId);
    if (!wordToMove) {
      return { success: false, message: `Word not found in source list` };
    }

    // Moving across languages invalidates translations (wrong target language):
    // bump version + clear translations so the backend retranslates. A
    // same-language move keeps translations valid.
    const crossLanguage = sourceList.language !== targetList.language;
    const moved = crossLanguage
      ? { ...wordToMove, version: (wordToMove.version ?? 0) + 1, word_translation: null, example_phrase_translation: null }
      : wordToMove;

    const next = allWordlistsRef.current.map(list => {
      if (list.id === sourceListId) {
        return { ...list, _isDirty: true, words: list.words.filter(w => w.id !== wordId) };
      }
      if (list.id === targetListId) {
        return { ...list, _isDirty: true, words: [...list.words, moved] };
      }
      return list;
    });
    commit(next);
    syncCoordinatorRef.current?.flush();

    return {
      success: true,
      message: `Moved "${wordToMove.word}" from "${sourceList.name}" to "${targetList.name}"`,
    };
  }, [commit]);

  // Create a new list with a word and optional sentence context
  const createNewListWithWord = useCallback(async (word, listName = null, sentenceContext = null) => {
    if (!word.trim()) {
      return { success: false, message: 'No word provided' };
    }

    const newListName = listName || `Word List ${new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`;

    try {
      // Create the list in the backend - we need to do this immediately since we need an ID
      const result = await createWordlist({
        name: newListName,
        words: [{
          id: crypto.randomUUID(),
          word: word.trim(),
          version: 0,
          word_translation: null,
          example_phrase: sentenceContext || null,
          example_phrase_translation: null
        }],
        language: currentLanguage // Include language when creating new list
      }, currentLanguage);

      if (!result) {
        throw new Error('Failed to create list');
      }

      // Add the new list to our local state. The backend already generated
      // translations on create, so it is not dirty.
      const newList = {
        ...result,
        words: (result.words || []).map(normalizeWord),
        _isDirty: false
      };
      commit([...allWordlistsRef.current, newList]);

      return {
        success: true,
        message: `Created new list "${newListName}" with word "${word}"${sentenceContext ? ' and sentence context' : ''}`,
        list: result,
      };
    } catch (err) {
      console.error('Failed to create new list:', err);
      return {
        success: false,
        message: 'Failed to create new list',
      };
    }
  }, [commit, currentLanguage]);

  // Force sync with backend - flushes dirty lists via the coordinator, then refetches.
  const syncWithBackend = useCallback(async () => {
    try {
      // Flush any dirty lists first (coordinator guards concurrency).
      await syncCoordinator.flush();

      // Reset the loaded languages to force a fresh fetch
      loadedLanguages.current.clear();

      // Reload both languages from backend
      await loadWordlists(true);

      return { success: true, message: 'Synchronized with server' };
    } catch (err) {
      console.error('Failed to sync with backend:', err);
      return { success: false, message: 'Failed to sync with server' };
    }
  }, [loadWordlists, syncCoordinator]);

  // Remove a word from a list (identified by its stable word id)
  const removeWordFromList = useCallback((wordId, listId) => {
    if (!wordId) {
      return { success: false, message: 'No word provided' };
    }

    // Find the target list
    const targetList = allWordlistsRef.current.find(list => list.id === listId);
    if (!targetList) {
      return { success: false, message: 'List not found' };
    }

    const word = targetList.words.find(w => w.id === wordId);
    if (!word) {
      return { success: false, message: `Word not found in list` };
    }

    const next = allWordlistsRef.current.map(list =>
      list.id === listId
        ? { ...list, _isDirty: true, words: list.words.filter(w => w.id !== wordId) }
        : list
    );
    commit(next);
    syncCoordinatorRef.current?.flush();

    return {
      success: true,
      message: `Removed "${word.word}" from list "${targetList.name}"`,
    };
  }, [commit]);

  // context value:
  const value = {
    wordlists, // This is filtered for current language
    allWordlists, // Provide access to all wordlists if needed
    loading: loadingWordLists,
    error,
    currentLanguage,
    changeLanguage,
    refreshWordlists: loadWordlists,
    findWordInLists,
    addWordToList,
    updateWordField,
    moveWordBetweenLists,
    createNewListWithWord,
    syncWithBackend,
    removeWordFromList,
  };

  return (
    <WordlistContext.Provider value={value}>
      {children}
    </WordlistContext.Provider>
  );
}

export default WordlistProvider;