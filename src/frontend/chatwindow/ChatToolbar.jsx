import React, { useState } from 'react';
import './ChatToolbar.css';
import { normalizePhrase, areCloseMatches } from '../wordlist/utils';

const ChatToolbar = ({ 
  toolbarRef,
  style, 
  handleTranslate, 
  handleRollback, 
  showDictionaryButton, 
  checkInDictionary, 
  showRollback,
  isVisible,
  selectedText,
  wordLists,
  onAddToList,
  onMoveToList,
  onCreateNewList,
}) => {
  const [showListDropdown, setShowListDropdown] = useState(false);
  
  const onClickHandler = (e) => {
    e.stopPropagation();
  };
  
  // If not visible, don't render
  if (!isVisible) {
    return null;
  }

  // Find if the selected text is already in any list (exact or close match)
  const findMatch = (text) => {
    if (!text || !wordLists) return null;
    
    const normalizedNew = normalizePhrase(text);

    for (const list of wordLists) {
      for (const w of list.words) {
        const normalizedExisting = normalizePhrase(w.word);
        // Exact match
        if (normalizedExisting === normalizedNew) {
          return {
            matchType: 'exact',
            word: w.word,
            listId: list.id,
            listName: list.name,
          };
        }
        // Close match
        if (areCloseMatches(normalizedExisting, normalizedNew)) {
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
  };

  const match = selectedText ? findMatch(selectedText) : null;
  const isInList = !!match;

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setShowListDropdown(!showListDropdown);
  };

  const handleAddToList = (listId) => {
    setShowListDropdown(false);
    if (onAddToList) onAddToList(selectedText, listId);
  };

  const handleMoveToList = (targetListId) => {
    setShowListDropdown(false);
    if (onMoveToList && match) onMoveToList(selectedText, match.listId, targetListId);
  };

  const handleCreateNewList = () => {
    setShowListDropdown(false);
    if (onCreateNewList) onCreateNewList(selectedText);
  };

  return (
    <div 
      className="chat-toolbar" 
      style={style} 
      onClick={onClickHandler}
      ref={toolbarRef}
    >
      <button onClick={() => handleTranslate('ru')}>ru</button>
      <button onClick={() => handleTranslate('en')}>en</button>
      <button onClick={() => handleTranslate('es')}>es</button>
      
      {showDictionaryButton() && (
        <button onClick={checkInDictionary} className="dictionary-button"></button>
      )}
      
      {selectedText && (
        <>
          {isInList ? (
            <button onClick={toggleDropdown} className="move-word-button">
             m
            </button>
          ) : (
            <button onClick={toggleDropdown} className="add-word-button">
              a
            </button>
          )}
          
          {showListDropdown && (
            <div className="list-dropdown">
              {wordLists?.map(list => {
                // Check if this list has an exact or close match
                let exactMatchWord = null;
                let closeMatchWord = null;
                
                for (const w of list.words) {
                  if (normalizePhrase(w.word) === normalizePhrase(selectedText)) {
                    exactMatchWord = w.word;
                    break;
                  } else if (areCloseMatches(normalizePhrase(w.word), normalizePhrase(selectedText))) {
                    closeMatchWord = w.word;
                    if (!exactMatchWord) break; // If we already found an exact match, no need to keep looking
                  }
                }
                
                // Truncate match text if too long for tooltip
                const truncateText = (text, maxLength = 30) => {
                  if (text && text.length > maxLength) {
                    return text.substring(0, maxLength) + '...';
                  }
                  return text;
                };
                
                return (
                  <div 
                    key={list.id} 
                    className="list-item"
                    onClick={() => isInList ? handleMoveToList(list.id) : handleAddToList(list.id)}
                  >
                    {list.name} 
                    {exactMatchWord && (
                      <div className="match-indicator-tooltip">
                        <img 
                          src="/src/frontend/assets/toolbar-exact-match.png" 
                          alt="Exact match"
                        />
                        <span className="tooltiptext">Exact match: "{truncateText(exactMatchWord)}"</span>
                      </div>
                    )}
                    {closeMatchWord && !exactMatchWord && (
                      <div className="match-indicator-tooltip">
                        <img 
                          src="/src/frontend/assets/toolbar-close-match.png" 
                          alt="Close match"
                        />
                        <span className="tooltiptext">Close match: "{truncateText(closeMatchWord)}"</span>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {!isInList && (
                <div className="list-item new-list" onClick={handleCreateNewList}>
                  Create new list
                </div>
              )}
            </div>
          )}
        </>
      )}
      
      {showRollback && (
        <button onClick={handleRollback} className="rollback-button">
          Rollback
        </button>
      )}
    </div>
  );
};

export default ChatToolbar;