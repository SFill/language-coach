import React, { useState, useEffect } from 'react';
import './ChatToolbar.css';
import { areExactMatches, areCloseMatches } from '../wordlist/utils';

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

  const selectedTextWithNoTags = (() => {
    const temp = document.createElement('div');
    temp.innerHTML = selectedText;
    return temp.textContent || temp.innerText || '';
  })();

  // If not visible, don't render
  if (!isVisible) {
    return null;
  }

  // Find if the selected text is already in any list (exact or close match)
  const findMatch = (text) => {
    if (!text || !wordLists) return [];

    const matches = []

    for (const list of wordLists) {
      for (const w of list.words) {
        // Exact match
        if (areExactMatches(w.word, selectedTextWithNoTags)) {
          matches.push({
            matchType: 'exact',
            word: w.word,
            listId: list.id,
            listName: list.name,
          });
        }
        // Close match
        if (areCloseMatches(w.word, selectedText)) {
          matches.push({
            matchType: 'close',
            word: w.word,
            listId: list.id,
            listName: list.name,
          });
        }
      }
    }
    return matches;
  };

  const matches = findMatch(selectedText);
  const isInList = matches.length > 0;
  const exactMatch = matches.find(match => match.matchType === 'exact') || null;

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setShowListDropdown(!showListDropdown);
  };

  const handleAddToList = async (listId) => {
    if (!onAddToList) return;

    const result = await onAddToList(selectedTextWithNoTags, listId);
    if (result && result.message) {
      console.log(result.message);
    }
  };

  const handleMoveToList = async (targetListId) => {
    // it's an exact match
    if (!onMoveToList || !exactMatch) return;
    const result = await onMoveToList(selectedTextWithNoTags, exactMatch.listId, targetListId);

    if (result && result.message) {
      console.log(result.message);
    }
  };

  const handleCreateNewList = async () => {
    if (!onCreateNewList) return;

    const result = await onCreateNewList(selectedText);
    if (result && result.message) {
      console.log(result.message);
    }
  };

  return (
    <div
      className="chat-toolbar"
      style={style}
      ref={toolbarRef}
    >
      <button onClick={() => handleTranslate('ru')}>ru</button>
      <button onClick={() => handleTranslate('en')}>en</button>
      <button onClick={() => handleTranslate('es')}>es</button>

      {showDictionaryButton() && (
        <button onClick={checkInDictionary} className="dictionary-button"></button>
      )}

      {selectedTextWithNoTags && (
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
                let exactMatchWord = list.id == exactMatch?.listId ? exactMatch.word : null;
                let closeMatches = [];

                for (const w of list.words) {

                  if (!areExactMatches(w.word, selectedTextWithNoTags) && areCloseMatches(w.word, selectedTextWithNoTags)) {
                    closeMatches.push(w.word);
                  }
                }

                // Truncate match text if too long for tooltip
                const truncateText = (text, maxLength = 70) => {
                  if (text && text.length > maxLength) {
                    return text.substring(0, maxLength) + '...';
                  }
                  return text;
                };

                return (
                  <div
                    key={list.id}
                    className="list-item"
                    onClick={() => exactMatch ? handleMoveToList(list.id) : handleAddToList(list.id)}
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
                    {closeMatches.length > 0 && (
                      // TODO: add multiple close matches indicator
                      <div className="match-indicator-tooltip">
                        <img
                          src="/src/frontend/assets/toolbar-close-match.png"
                          alt="Close match"
                        />
                        <span className="tooltiptext">Close match: "{truncateText(closeMatches[0])}"</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {!exactMatch && (
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