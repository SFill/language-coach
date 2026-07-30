import React, { useState, useRef, useEffect } from "react";
import { useWordlist } from "./WordlistContext";
import styles from "./WordLists.module.css";

// Helper function to split an array into chunks of the given size
const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

function WordLists() {
  const {
    wordlists,
    loading,
    error,
    removeWordFromList,
    updateWordField,
    currentLanguage,
  } = useWordlist();

  // Which cards are showing their back face. Keyed by `${listId}-${wordId}` so
  // identity is stable across edits/removes (never by position).
  const [flippedCards, setFlippedCards] = useState(new Set());
  // editing = { listId, wordId, field: 'word' | 'example_phrase', original, value }
  const [editing, setEditing] = useState(null);
  const editInputRef = useRef(null);

  // Focus + select only when a NEW field edit begins. Keying on the target
  // (list/word/field) — NOT on `editing` itself — means typing (which updates
  // editing.value) does NOT re-run this effect; otherwise every keystroke would
  // re-select the whole text and the next key would replace it.
  const editTargetKey = editing ? `${editing.listId}:${editing.wordId}:${editing.field}` : null;
  useEffect(() => {
    if (editTargetKey && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select?.();
    }
  }, [editTargetKey]);

  // Flip a card (but not when interacting with the word, phrase, or buttons)
  const handleCardClick = (e, listId, wordId) => {
    if (
      editing ||
      e.target.closest(`.${styles.cardActions}`) ||
      e.target.closest(`.${styles.wordTitle}`) ||
      e.target.closest(`.${styles.examplePhrase}`) ||
      e.target.closest(`.${styles.wordEditInput}`)
    ) {
      return;
    }
    const cardId = `${listId}-${wordId}`;
    setFlippedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const startEdit = (e, listId, wordItem, field) => {
    e.stopPropagation();
    // Commit any other in-flight edit before starting a new one.
    if (editing) handleEditSave();
    setEditing({
      listId,
      wordId: wordItem.id,
      field,
      original: wordItem[field] ?? "",
      value: wordItem[field] ?? "",
    });
  };

  const handleEditChange = (e) => {
    setEditing(prev => (prev ? { ...prev, value: e.target.value } : prev));
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter' && editing?.field === 'word') {
      e.preventDefault();
      handleEditSave();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleEditSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(null);
    }
  };

  const handleEditBlur = () => {
    handleEditSave();
  };

  const handleEditSave = () => {
    if (!editing) return;
    const { listId, wordId, field, original, value } = editing;
    const trimmed = value.trim();
    setEditing(null);
    // Empty or unchanged → nothing to sync.
    if (!trimmed || trimmed === original) return;
    updateWordField(wordId, field, listId, trimmed);
  };

  const handleDeleteWord = (e, listId, wordItem) => {
    e.stopPropagation();
    removeWordFromList(wordItem.id, listId);
    const cardId = `${listId}-${wordItem.id}`;
    setFlippedCards(prev => {
      const next = new Set(prev);
      next.delete(cardId);
      return next;
    });
    if (editing && editing.wordId === wordItem.id && editing.listId === listId) {
      setEditing(null);
    }
  };

  const isWordBeingEdited = (listId, wordItem, field) =>
    editing &&
    editing.listId === listId &&
    editing.wordId === wordItem.id &&
    editing.field === field;

  const isCardFlipped = (cardId) => flippedCards.has(cardId);

  // Export wordlist to markdown format
  const exportToMarkdown = (list) => {
    let markdown = `# ${list.name}\n\n`;

    if (list.words && list.words.length > 0) {
      list.words.forEach((wordItem) => {
        markdown += `${wordItem.word},`;

        // Add example phrase if available
        if (wordItem.example_phrase) {
          markdown += ` ${wordItem.example_phrase}`;
        }

        markdown += " :: ";

        // Add word translation if available
        if (wordItem.word_translation) {
          markdown += `${wordItem.word_translation},`;
        }

        // Add example phrase translation if available
        if (wordItem.example_phrase_translation) {
          markdown += ` ${wordItem.example_phrase_translation}`;
        }

        markdown += `\n`;
      });
    } else {
      markdown += `No words in this list.\n\n`;
    }

    // Copy to clipboard
    navigator.clipboard.writeText(markdown).then(() => {
      console.log('Markdown copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
    });
  };

  if (loading) return <p>Loading word lists...</p>;
  if (error) return <p>Error fetching word lists: {error}</p>;
  if (!wordlists || wordlists.length === 0) return <p>No word lists available for {currentLanguage === "en" ? "English" : "Spanish"}.</p>;

  return (
    <div className={styles.wordlistsContainer}>
      <div className={styles.languageInfo}>
        <p>Displaying {currentLanguage === "en" ? "English" : "Spanish"} word lists</p>
      </div>

      {wordlists.map((list) => {
        // Break the words into rows of 3 cards each.
        const rows = chunkArray(list.words || [], 3);
        return (
          <div key={list.id} id={`wordlist-${list.id}`} className={styles.wordlist}>
            <div className={styles.listHeader}>
              <h2 className={styles.listName}>
                {list.name}
                {list._isDirty && (
                  <span className={styles.dirtyIndicator}>
                    (unsaved changes)
                  </span>
                )}
                {list.language && list.language !== currentLanguage && (
                  <span className={styles.languageBadge}>
                    {list.language.toUpperCase()}
                  </span>
                )}
              </h2>
              <button
                className={styles.exportButton}
                onClick={(e) => {
                  e.stopPropagation();
                  exportToMarkdown(list);
                }}
                title="Export to Markdown (copy to clipboard)"
              >
                📋 Export MD
              </button>
            </div>
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className={styles.cardRow}>
                {row.map((wordItem) => {
                  const cardId = `${list.id}-${wordItem.id}`;
                  const isFlipped = isCardFlipped(cardId);

                  return (
                    <div
                      key={cardId}
                      onClick={(e) => handleCardClick(e, list.id, wordItem.id)}
                      className={`${styles.wordCard} ${isFlipped ? styles.flipped : ''}`}
                    >
                      <div className={styles.cardInner}>
                        {/* Front Face */}
                        <div className={styles.cardFront}>
                          <div className={styles.cardContent}>
                            {/* Editable word title */}
                            <div className={styles.wordTitleContainer}>
                              {isWordBeingEdited(list.id, wordItem, 'word') ? (
                                <input
                                  ref={editInputRef}
                                  type="text"
                                  value={editing.value}
                                  onChange={handleEditChange}
                                  onKeyDown={handleEditKeyDown}
                                  onBlur={handleEditBlur}
                                  className={styles.wordEditInput}
                                />
                              ) : (
                                <h3
                                  className={`${styles.wordTitle} ${wordItem._isUpdating ? styles.updating : ''}`}
                                  onClick={(e) => startEdit(e, list.id, wordItem, 'word')}
                                  title="Click to edit"
                                >
                                  {wordItem._isUpdating ? (
                                    <>
                                      <span className={styles.loadingSpinner}>⏳</span>
                                      {wordItem.word}
                                    </>
                                  ) : (
                                    wordItem.word
                                  )}
                                </h3>
                              )}
                            </div>

                            {/* Editable example phrase */}
                            {isWordBeingEdited(list.id, wordItem, 'example_phrase') ? (
                              <textarea
                                ref={editInputRef}
                                value={editing.value}
                                onChange={handleEditChange}
                                onKeyDown={handleEditKeyDown}
                                onBlur={handleEditBlur}
                                className={styles.exampleEditInput}
                                rows={2}
                              />
                            ) : (
                              <div
                                className={styles.examplePhrase}
                                onClick={(e) => startEdit(e, list.id, wordItem, 'example_phrase')}
                                title="Click to edit"
                              >
                                {wordItem.example_phrase ? (
                                  <p>{wordItem.example_phrase}</p>
                                ) : (
                                  <p className={styles.examplePhrasePlaceholder}>
                                    Click to add an example phrase
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Card actions */}
                            <div className={styles.cardActions}>
                              {/* Delete button */}
                              <button
                                onClick={(e) => handleDeleteWord(e, list.id, wordItem)}
                                className={styles.deleteButton}
                                title="Delete word"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Back Face */}
                        <div className={styles.cardBack}>
                          <div className={styles.cardContent}>
                            {/* Word translation */}
                            {wordItem.word_translation && (
                              <div className={styles.translationSection}>
                                <h4 className={styles.sectionTitle}>Translation</h4>
                                <p className={styles.wordTranslation}>{wordItem.word_translation}</p>
                              </div>
                            )}

                            {/* Example phrase translation */}
                            {wordItem.example_phrase_translation && (
                              <div className={styles.translationSection}>
                                <h4 className={styles.sectionTitle}>Example Translation</h4>
                                <p className={styles.exampleTranslation}>{wordItem.example_phrase_translation}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Fill empty spaces in the row to maintain grid alignment */}
                {row.length < 3 && Array.from({ length: 3 - row.length }, (_, i) => (
                  <div key={`empty-${i}`} className={styles.emptyCard}></div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default WordLists;