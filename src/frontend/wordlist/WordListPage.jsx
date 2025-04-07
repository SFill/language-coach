import React from 'react';
import ReverseContext from './ReverseContext';
import WordLists from './WordLists';;
import { useWordlist } from './WordlistContext';
import './WordListPage.css';

const WordListPage = () => {
  // Access the wordlist context
  const {
    wordlists,
    loading,
    error,
    refreshWordlists,
    syncWithBackend,
    addWordToList,
    moveWordBetweenLists,
    createNewListWithWord
  } = useWordlist();

  const handleRefresh = async () => {
    const result = await syncWithBackend();
    // You could add notification handling here if needed
    console.log(result.message);
  };

  return (
    <div className="page word-list-page">
      <div className='word-list-page-container'>
        {/* Status information */}
        <div className="wordlist-status">
          {loading && <p>Loading wordlists...</p>}
          {error && <p className="error">{error}</p>}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="refresh-button"
          >
            Sync with Server
          </button>
        </div>

        {/* Pass wordlist data to components */}
        <ReverseContext />

        {/* Pass the wordlists data from context to existing components */}
        {/* We'll let WordLists use the context directly */}
        <WordLists />


      </div>
    </div>
  );
};

export default WordListPage;