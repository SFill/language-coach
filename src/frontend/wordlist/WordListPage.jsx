import React, { useEffect } from 'react';
import ReverseContext from './ReverseContext';
import WordLists from './WordLists';;
import { useWordlist } from './WordlistContext';
import './WordListPage.css';

const WordListPage = () => {
  // Access the wordlist context
  const {
    wordlists,
    allWordlists,
    loading,
    error,
    refreshWordlists,
    syncWithBackend,
    addWordToList,
    moveWordBetweenLists,
    createNewListWithWord
  } = useWordlist();

  // Auto-sync dirty cards when navigating to this page
  useEffect(() => {
    const hasDirtyCards = allWordlists.some(list => list._isDirty);
    if (hasDirtyCards) {
      console.log('Auto-syncing dirty cards on page navigation');
      syncWithBackend();
    }
  }, []); // Empty dependency array - runs only when component mounts (page navigation)

  const handleRefresh = async () => {
    const result = await syncWithBackend();
    // You could add notification handling here if needed
    console.log(result.message);
  };

  // Create table of contents for navigation
  const tableOfContents = wordlists
    .slice() // Create a copy to avoid mutating original array
    .sort((a, b) => b.name.localeCompare(a.name)) // Sort by name descending
    .map(list => ({
      id: list.id,
      name: list.name,
      wordCount: list.words?.length || 0
    }));


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

        {/* Table of Contents Navigation */}
        {tableOfContents.length > 0 && (
          <div className="table-of-contents">
            <h3>Quick Navigation</h3>
            <div className="toc-items">
              {tableOfContents.map(item => (
                <a
                  key={item.id}
                  href={`#wordlist-${item.id}`}
                  className="toc-item"
                  title={`${item.name} (${item.wordCount} words)`}
                >
                  {item.name}
                  <span className="word-count">({item.wordCount})</span>
                </a>
              ))}
            </div>
          </div>
        )}

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