import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  fetchWordlists, 
  createWordlist, 
  updateWordlist, 
  deleteWordlist,
  updateWordListsBeforeRefresh
} from '../api';
import { normalizePhrase, areCloseMatches } from './utils';

// Create the context
const WordlistContext = createContext();

// Custom hook to use the wordlist context
export function useWordlist() {
  return useContext(WordlistContext);
}

export function WordlistProvider({ children }) {
  const [wordlists, setWordlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastSyncTime = useRef(null);
  const syncInProgress = useRef(false);
  
  // Load wordlists from API
  const loadWordlists = useCallback(async (force = false) => {
    // Prevent multiple simultaneous sync operations
    if (syncInProgress.current && !force) return;
    
    syncInProgress.current = true;
    setLoading(true);
    
    try {
      const data = await fetchWordlists();
      setWordlists(data);
      lastSyncTime.current = new Date();
      setError(null);
    } catch (err) {
      console.error('Failed to load wordlists:', err);
      setError('Failed to load word lists. Please try again later.');
    } finally {
      setLoading(false);
      syncInProgress.current = false;
    }
  }, []);
  
  // Use a ref to track the current wordlists without causing effect dependencies
  const wordlistsRef = useRef([]);
  
  // Update the ref whenever wordlists changes
  useEffect(() => {
    wordlistsRef.current = wordlists;
  }, [wordlists]);
  
  // Initial load on component mount and set up sync
  useEffect(() => {
    // Initial load
    loadWordlists();
    
    // Function to check for and sync dirty lists
    const syncDirtyLists = async () => {
      if (syncInProgress.current) return;
      
      const currentLists = wordlistsRef.current;
      const dirtyLists = currentLists.filter(list => list._isDirty);
      if (dirtyLists.length === 0) return;
      
      syncInProgress.current = true;
      
      try {
        // Push changes to backend
        const syncPromises = dirtyLists.map(list => 
          updateWordlist(list.id, {
            name: list.name,
            words: list.words.map(w => w.word)
          })
        );
        
        await Promise.all(syncPromises);
        
        // Mark lists as clean after successful sync
        setWordlists(prev => 
          prev.map(list => 
            list._isDirty ? { ...list, _isDirty: false } : list
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
  }, [loadWordlists]); // Remove wordlists from dependencies
  
  // Save wordlists before window unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Sync any pending changes
      const dirtyLists = wordlistsRef.current.filter(list => list._isDirty);
      if (dirtyLists.length > 0) {
        updateWordListsBeforeRefresh(dirtyLists);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
  
  // Find a word in any list (exact or close match)
  const findWordInLists = useCallback((text) => {
    if (!text || !text.trim()) return null;
    
    const normalizedText = normalizePhrase(text);
    
    for (const list of wordlists) {
      for (const w of list.words) {
        const normalizedExisting = normalizePhrase(w.word);
        
        // Exact match
        if (normalizedExisting === normalizedText) {
          return {
            matchType: 'exact',
            word: w.word,
            listId: list.id,
            listName: list.name,
          };
        }
        
        // Close match
        if (areCloseMatches(normalizedExisting, normalizedText)) {
          return {
            matchType: 'close',
            word: w.word,
            listId: list.id,
            listName: list.name,
          };
        }
      }
    }
    
    // No match found
    return null;
  }, [wordlists]);
  
  // Add a word to a list
  const addWordToList = useCallback((word, listId) => {
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
    const targetList = wordlists.find(list => list.id === listId);
    if (!targetList) {
      return { success: false, message: 'List not found' };
    }
    
    // Update the list in local state for immediate UI feedback
    const updatedList = {
      ...targetList,
      _isDirty: true,
      words: [
        ...targetList.words,
        { word: word.trim(), definition: 'Added from chat window' }
      ]
    };
    
    setWordlists(prev => 
      prev.map(list => list.id === listId ? updatedList : list)
    );
    
    return {
      success: true,
      message: `Added "${word}" to list "${targetList.name}"`,
    };
  }, [wordlists, findWordInLists]);
  
  // Move a word from one list to another
  const moveWordBetweenLists = useCallback((word, sourceListId, targetListId) => {
    if (!word.trim() || sourceListId === targetListId) {
      return { success: false, message: 'Invalid operation' };
    }
    
    // Find the source and target lists
    const sourceList = wordlists.find(list => list.id === sourceListId);
    const targetList = wordlists.find(list => list.id === targetListId);
    
    if (!sourceList || !targetList) {
      return { success: false, message: 'One or more lists not found' };
    }
    
    // Find the word in the source list
    const normalizedWord = normalizePhrase(word);
    const sourceWordIndex = sourceList.words.findIndex(w => 
      normalizePhrase(w.word) === normalizedWord ||
      areCloseMatches(normalizePhrase(w.word), normalizedWord)
    );
    
    if (sourceWordIndex === -1) {
      return { success: false, message: 'Word not found in source list' };
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
    
    setWordlists(prev => 
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
  }, [wordlists]);
  
  // Create a new list with a word
  const createNewListWithWord = useCallback(async (word, listName = null) => {
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
        words: [word.trim()]
      });
      
      if (!result) {
        throw new Error('Failed to create list');
      }
      
      // Add the new list to our local state
      setWordlists(prev => [...prev, result]);
      
      return {
        success: true,
        message: `Created new list "${newListName}" with word "${word}"`,
        list: result,
      };
    } catch (err) {
      console.error('Failed to create new list:', err);
      return {
        success: false,
        message: 'Failed to create new list',
      };
    }
  }, []);
  
  // Force sync with backend
  const syncWithBackend = useCallback(async () => {
    if (syncInProgress.current) {
      return { success: false, message: 'Sync already in progress' };
    }
    
    syncInProgress.current = true;
    
    try {
      // Sync any dirty lists first
      const dirtyLists = wordlists.filter(list => list._isDirty);
      
      if (dirtyLists.length > 0) {
        const syncPromises = dirtyLists.map(list => 
          updateWordlist(list.id, {
            name: list.name,
            words: list.words.map(w => w.word)
          })
        );
        
        await Promise.all(syncPromises);
      }
      
      // Reload from backend
      await loadWordlists(true);
      
      return { success: true, message: 'Synchronized with server' };
    } catch (err) {
      console.error('Failed to sync with backend:', err);
      return { success: false, message: 'Failed to sync with server' };
    } finally {
      syncInProgress.current = false;
    }
  }, [wordlists, loadWordlists]);
  
  // Context value
  const value = {
    wordlists,
    loading,
    error,
    refreshWordlists: loadWordlists,
    findWordInLists,
    addWordToList,
    moveWordBetweenLists,
    createNewListWithWord,
    syncWithBackend,
  };
  
  return (
    <WordlistContext.Provider value={value}>
      {children}
    </WordlistContext.Provider>
  );
}

export default WordlistProvider;