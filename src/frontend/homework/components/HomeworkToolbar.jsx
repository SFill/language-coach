import React, { useState } from 'react';
import './HomeworkToolbar.css';
import { areExactMatches, areCloseMatches } from '../../wordlist/utils';

const HomeworkToolbar = ({
  toolbarRef,
  style,
  onTranslate,
  onDictionaryLookup,
  selectedText,
  wordLists,
  onAddToList,
  onMoveToList,
  onCreateNewList,
  isVisible,
}) => {
  const [showListDropdown, setShowListDropdown] = useState(false);

  const plainText = (() => {
    const temp = document.createElement('div');
    temp.innerHTML = selectedText;
    return temp.textContent || temp.innerText || '';
  })();

  if (!isVisible) {
    return null;
  }

  const findMatches = (text) => {
    if (!text || !wordLists) return [];
    const matches = [];
    for (const list of wordLists) {
      for (const w of list.words) {
        if (areExactMatches(w.word, plainText)) {
          matches.push({
            matchType: 'exact',
            word: w.word,
            listId: list.id,
            listName: list.name,
          });
        }
        if (areCloseMatches(w.word, text)) {
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

  const matches = findMatches(selectedText);
  const isInList = matches.length > 0;
  const exactMatch = matches.find((m) => m.matchType === 'exact') || null;

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setShowListDropdown(!showListDropdown);
  };

  const handleAddToList = async (listId) => {
    if (!onAddToList) return;
    const result = await onAddToList(plainText, listId);
    if (result?.message) console.log(result.message);
  };

  const handleMoveToList = async (targetListId) => {
    if (!onMoveToList || !exactMatch) return;
    const result = await onMoveToList(plainText, exactMatch.listId, targetListId);
    if (result?.message) console.log(result.message);
  };

  const handleCreateNewList = async () => {
    if (!onCreateNewList) return;
    const result = await onCreateNewList(selectedText);
    if (result?.message) console.log(result.message);
  };

  return (
    <div className="hw-selection-toolbar" style={style} ref={toolbarRef}>
      {/* <button onClick={() => onTranslate('ru')}>ru</button>
      <button onClick={() => onTranslate('en')}>en</button>
      <button onClick={() => onTranslate('es')}>es</button> */}

      {onDictionaryLookup && (
        <button onClick={onDictionaryLookup} className="hw-selection-toolbar-dict" />
      )}

      {plainText && (
        <>
          {isInList ? (
            <button onClick={toggleDropdown} className="hw-selection-toolbar-move">
              m
            </button>
          ) : (
            <button onClick={toggleDropdown} className="hw-selection-toolbar-add">
              a
            </button>
          )}

          {showListDropdown && (
            <div className="hw-selection-toolbar-dropdown">
              {wordLists?.map((list) => {
                const exactWord = list.id === exactMatch?.listId ? exactMatch.word : null;
                const closeMatches = [];
                for (const w of list.words) {
                  if (!areExactMatches(w.word, plainText) && areCloseMatches(w.word, plainText)) {
                    closeMatches.push(w.word);
                  }
                }

                const truncate = (text, maxLen = 70) =>
                  text && text.length > maxLen ? text.substring(0, maxLen) + '...' : text;

                return (
                  <div
                    key={list.id}
                    className="hw-selection-toolbar-list-item"
                    onClick={() => (exactMatch ? handleMoveToList(list.id) : handleAddToList(list.id))}
                  >
                    {list.name}
                    {exactWord && (
                      <div className="hw-selection-toolbar-match-tooltip">
                        <img src="/src/frontend/assets/toolbar-exact-match.png" alt="Exact match" />
                        <span className="hw-selection-toolbar-match-tooltip-text">
                          Exact match: &ldquo;{truncate(exactWord)}&rdquo;
                        </span>
                      </div>
                    )}
                    {closeMatches.length > 0 && (
                      <div className="hw-selection-toolbar-match-tooltip">
                        <img src="/src/frontend/assets/toolbar-close-match.png" alt="Close match" />
                        <span className="hw-selection-toolbar-match-tooltip-text">
                          Close match: &ldquo;{truncate(closeMatches[0])}&rdquo;
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {!exactMatch && (
                <div className="hw-selection-toolbar-list-item hw-selection-toolbar-new-list" onClick={handleCreateNewList}>
                  Create new list
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HomeworkToolbar;