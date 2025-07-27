import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchWordlists,
  createWordlist,
  updateWordlist,
  deleteWordlist,
  updateWordListsBeforeRefresh
} from '../api';
import { normalizePhrase, areCloseMatches, areExactMatches } from './utils';

// Create the context
const WordlistContext = createContext();

// LocalStorage key for language preference
const LANGUAGE_STORAGE_KEY = 'language_preference';

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
  const lastSyncTime = useRef(null);
  const syncInProgress = useRef(false);
  
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
    // Prevent multiple simultaneous sync operations
    if (syncInProgress.current && !force) return;

    syncInProgress.current = true;
    setLoadingWordLists(true);

    try {
      // First, check if we already have English wordlists
      if (!loadedLanguages.current.has('en') || force) {
        const enWordlists = await fetchWordlists('en');
        
        // Add in-memory flags to each wordlist
        const processedEnWordlists = enWordlists.map(list => ({
          ...list,
          _isDirty: false
        }));
        
        // Update allWordlists, preserving Spanish wordlists if they exist
        setAllWordlists(prevAll => {
          const existingEs = prevAll.filter(list => list.language === 'es');
          return [...existingEs, ...processedEnWordlists];
        });
        
        loadedLanguages.current.add('en');
      }
      
      // Then, check if we already have Spanish wordlists
      if (!loadedLanguages.current.has('es') || force) {
        const esWordlists = await fetchWordlists('es');
        
        // Add in-memory flags to each wordlist
        const processedEsWordlists = esWordlists.map(list => ({
          ...list,
          _isDirty: false
        }));
        
        // Update allWordlists, preserving English wordlists
        setAllWordlists(prevAll => {
          const existingEn = prevAll.filter(list => list.language === 'en');
          return [...existingEn, ...processedEsWordlists];
        });
        
        loadedLanguages.current.add('es');
      }
      
      // Update the timestamp of the last successful sync
      lastSyncTime.current = new Date();
      setError(null);
      
      // Filter for the current language
      filterWordlistsByLanguage(currentLanguage);
    } catch (err) {
      console.error('Failed to load wordlists:', err);
      setError('Failed to load word lists. Please try again later.');
    } finally {
      setLoadingWordLists(false);
      syncInProgress.current = false;
    }
  }, [currentLanguage, filterWordlistsByLanguage]);

  // Update filtered wordlists when allWordlists changes
  useEffect(() => {
    filterWordlistsByLanguage(currentLanguage);
  }, [allWordlists, currentLanguage, filterWordlistsByLanguage]);

  // Use a ref to track the current wordlists without causing effect dependencies
  const allWordlistsRef = useRef([]);

  // Update the ref whenever wordlists changes
  useEffect(() => {
    allWordlistsRef.current = allWordlists;
  }, [allWordlists]);

  // Initial load on component mount and set up sync
  useEffect(() => {
    // Initial load - get both languages at once
    loadWordlists();

    // Function to check for and sync dirty lists
    const syncDirtyLists = async () => {
      if (syncInProgress.current) return;

      const currentLists = allWordlistsRef.current;
      const dirtyLists = currentLists.filter(list => list._isDirty);
      if (dirtyLists.length === 0) return;

      syncInProgress.current = true;

      try {
        // Group dirty lists by language for more efficient updates
        const enDirtyLists = dirtyLists.filter(list => list.language === 'en');
        const esDirtyLists = dirtyLists.filter(list => list.language === 'es');
        
        // Sync English lists
        if (enDirtyLists.length > 0) {
          const enSyncPromises = enDirtyLists.map(list =>
            updateWordlist(list.id, {
              name: list.name,
              words: list.words.map(w => ({
                word: w.word,
                word_translation: w.word_translation || null,
                example_phrase: w.example_phrase || null,
                example_phrase_translation: w.example_phrase_translation || null
              })),
              language: list.language
            }, 'en')
          );
          await Promise.all(enSyncPromises);
        }
        
        // Sync Spanish lists
        if (esDirtyLists.length > 0) {
          const esSyncPromises = esDirtyLists.map(list =>
            updateWordlist(list.id, {
              name: list.name,
              words: list.words.map(w => ({
                word: w.word,
                word_translation: w.word_translation || null,
                example_phrase: w.example_phrase || null,
                example_phrase_translation: w.example_phrase_translation || null
              })),
              language: list.language
            }, 'es')
          );
          await Promise.all(esSyncPromises);
        }

        // Mark lists as clean and remove loading states after successful sync
        setAllWordlists(prev =>
          prev.map(list =>
            list._isDirty ? { 
              ...list, 
              _isDirty: false,
              words: list.words.map(word => ({ ...word, _isUpdating: false }))
            } : list
          )
        );

        console.log(`Synced ${dirtyLists.length} modified wordlists`);
      } catch (err) {
        console.error('Failed to sync dirty lists:', err);
      } finally {
        syncInProgress.current = false;
      }
    };

    // Set up periodic sync for dirty lists (every 1 minute)
    const syncInterval = setInterval(syncDirtyLists, 60 * 1000);

    // Clean up interval on unmount
    return () => clearInterval(syncInterval);
  }, [loadWordlists]); 

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
    
    // Sync any dirty lists before changing language
    const dirtyLists = allWordlistsRef.current.filter(list => list._isDirty);
    if (dirtyLists.length > 0) {
      const syncPromises = dirtyLists.map(list =>
        updateWordlist(list.id, {
          name: list.name,
          words: list.words.map(w => ({
            word: w.word,
            word_translation: w.word_translation || null,
            example_phrase: w.example_phrase || null,
            example_phrase_translation: w.example_phrase_translation || null
          })),
          language: list.language
        }, list.language) // Use the list's own language
      );
      
      Promise.all(syncPromises).then(() => {
        setCurrentLanguage(language);
      }).catch(err => {
        console.error("Error syncing before language change:", err);
        setCurrentLanguage(language); // Change language anyway
      });
    } else {
      setCurrentLanguage(language);
    }
  }, [currentLanguage]);

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
    const targetList = allWordlists.find(list => list.id === listId);
    if (!targetList) {
      return { success: false, message: 'List not found' };
    }

    // Update the list in local state for immediate UI feedback
    const updatedList = {
      ...targetList,
      _isDirty: true,
      words: [
        ...targetList.words,
        { 
          word: word.trim(),
          word_translation: null,
          example_phrase: sentenceContext || null,
          example_phrase_translation: null
        }
      ]
    };

    setAllWordlists(prev =>
      prev.map(list => list.id === listId ? updatedList : list)
    );

    return {
      success: true,
      message: `Added "${word}" to list "${targetList.name}"${sentenceContext ? ' with sentence context' : ''}`,
    };
  }, [allWordlists, findWordInLists]);

  // Update a word in a list and trigger meta information regeneration
  const updateWordInList = useCallback((wordIndex, newWord, listId) => {
    const targetList = allWordlists.find(list => list.id === listId);
    
    // Update the word and clear meta fields to trigger regeneration, add loading state
    const updatedWords = [...targetList.words];
    updatedWords[wordIndex] = {
      word: newWord.trim(),
      word_translation: null,
      example_phrase: null,
      example_phrase_translation: null,
      _isUpdating: true // Loading indicator
    };

    const updatedList = {
      ...targetList,
      _isDirty: true,
      words: updatedWords
    };

    setAllWordlists(prev =>
      prev.map(list => list.id === listId ? updatedList : list)
    );

    return {
      success: true,
      message: `Updated word to "${newWord}" in list "${targetList.name}", meta information will be regenerated`,
    };
  }, [allWordlists]);

  // Move a word from one list to another
  const moveWordBetweenLists = useCallback((word, sourceListId, targetListId) => {
    if (!word.trim() || sourceListId === targetListId) {
      return { success: false, message: 'Invalid operation' };
    }

    // Find the source and target lists
    const sourceList = allWordlists.find(list => list.id === sourceListId);
    const targetList = allWordlists.find(list => list.id === targetListId);

    if (!sourceList || !targetList) {
      return { success: false, message: 'One or more lists not found' };
    }

    // Find the word in the source list
    const sourceWordIndex = sourceList.words.findIndex(w =>
      areExactMatches(w.word, word)
    );

    if (sourceWordIndex === -1) {
      return { success: false, message: `Word not found in source list` };
    }

    // Get the word with its definition
    const wordToMove = sourceList.words[sourceWordIndex];

    // Update lists in local state for immediate UI feedback
    const updatedSourceList = {
      ...sourceList,
      _isDirty: true,
      words: sourceList.words.filter((_, i) => i !== sourceWordIndex)
    };

    const updatedTargetList = {
      ...targetList,
      _isDirty: true,
      words: [...targetList.words, wordToMove]
    };

    setAllWordlists(prev =>
      prev.map(list => {
        if (list.id === sourceListId) return updatedSourceList;
        if (list.id === targetListId) return updatedTargetList;
        return list;
      })
    );

    return {
      success: true,
      message: `Moved "${wordToMove.word}" from "${sourceList.name}" to "${targetList.name}"`,
    };
  }, [allWordlists]);

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
          word: word.trim(),
          word_translation: null,
          example_phrase: sentenceContext || null,
          example_phrase_translation: null
        }],
        language: currentLanguage // Include language when creating new list
      }, currentLanguage);

      if (!result) {
        throw new Error('Failed to create list');
      }

      // Add the new list to our local state with the in-memory flag
      const newList = {
        ...result,
        _isDirty: false
      };
      
      setAllWordlists(prev => [...prev, newList]);

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
  }, [currentLanguage]);

  // Force sync with backend - now syncs all languages
  const syncWithBackend = useCallback(async () => {
    if (syncInProgress.current) {
      return { success: false, message: 'Sync already in progress' };
    }

    syncInProgress.current = true;

    try {
      // Sync all dirty lists first by language
      const dirtyLists = allWordlistsRef.current.filter(list => list._isDirty);
      
      if (dirtyLists.length > 0) {
        // Group by language
        const enDirtyLists = dirtyLists.filter(list => list.language === 'en');
        const esDirtyLists = dirtyLists.filter(list => list.language === 'es');
        
        // Sync English lists
        if (enDirtyLists.length > 0) {
          const enSyncPromises = enDirtyLists.map(list =>
            updateWordlist(list.id, {
              name: list.name,
              words: list.words.map(w => ({
                word: w.word,
                word_translation: w.word_translation || null,
                example_phrase: w.example_phrase || null,
                example_phrase_translation: w.example_phrase_translation || null
              })),
              language: 'en'
            }, 'en')
          );
          await Promise.all(enSyncPromises);
        }
        
        // Sync Spanish lists
        if (esDirtyLists.length > 0) {
          const esSyncPromises = esDirtyLists.map(list =>
            updateWordlist(list.id, {
              name: list.name,
              words: list.words.map(w => ({
                word: w.word,
                word_translation: w.word_translation || null,
                example_phrase: w.example_phrase || null,
                example_phrase_translation: w.example_phrase_translation || null
              })),
              language: 'es'
            }, 'es')
          );
          await Promise.all(esSyncPromises);
        }
      }

      // Reset the loaded languages to force a fresh fetch
      loadedLanguages.current.clear();
      
      // Reload both languages from backend
      await loadWordlists(true);

      return { success: true, message: 'Synchronized with server' };
    } catch (err) {
      console.error('Failed to sync with backend:', err);
      return { success: false, message: 'Failed to sync with server' };
    } finally {
      syncInProgress.current = false;
    }
  }, [loadWordlists]);

  // Remove a word from a list
  const removeWordFromList = useCallback((word, listId) => {
    if (!word.trim()) {
      return { success: false, message: 'No word provided' };
    }

    // Find the target list
    const targetList = allWordlists.find(list => list.id === listId);
    if (!targetList) {
      return { success: false, message: 'List not found' };
    }

    // Find the word in the list
    const wordIndex = targetList.words.findIndex(w =>
      areExactMatches(w.word, word)
    );

    if (wordIndex === -1) {
      return { success: false, message: `Word "${word}" not found in list` };
    }

    // Update the list in local state for immediate UI feedback
    const updatedList = {
      ...targetList,
      _isDirty: true,
      words: targetList.words.filter((_, i) => i !== wordIndex)
    };

    setAllWordlists(prev =>
      prev.map(list => list.id === listId ? updatedList : list)
    );

    return {
      success: true,
      message: `Removed "${word}" from list "${targetList.name}"`,
    };
  }, [allWordlists]);

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
    updateWordInList, // New method for updating words
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