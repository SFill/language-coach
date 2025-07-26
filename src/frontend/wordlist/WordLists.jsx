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
    updateWordInList,
    currentLanguage
  } = useWordlist();
  
  const [flippedCards, setFlippedCards] = useState(new Set()); // Set of flipped card IDs
  const [editingWord, setEditingWord] = useState(null); // { listId, wordIndex, originalWord, newWord }
  const [isEditing, setIsEditing] = useState(false)
  const editInputRef = useRef(null);

  // Focus the edit input when editing starts
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
      console.log(isEditing)
    }
  }, [isEditing]);

  // Handle card flip when clicking on card (but not on word or buttons)
  const handleCardClick = (e, listId, wordIndex) => {
    // Don't flip if we're editing or clicking on buttons/word
    if (editingWord || e.target.closest(`.${styles.cardActions}`) || e.target.closest(`.${styles.wordTitle}`) || e.target.closest(`.${styles.wordEditInput}`)) {
      return;
    }

    const cardId = `${listId}-${wordIndex}`;
    
    setFlippedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId); // Flip back to front
      } else {
        newSet.add(cardId); // Flip to back
      }
      return newSet;
    });
  };

  const handleWordClick = (e, listId, wordItem, wordIndex) => {
    e.stopPropagation();
    if (editingWord){
      handleEditSave()
    }; // Don't start editing if already editing
    
    setEditingWord({
      listId,
      wordIndex,
      originalWord: wordItem.word,
      newWord: wordItem.word
    });
    setIsEditing(true)
  };

  const handleEditChange = (e) => {
    setEditingWord(prev => ({
      ...prev,
      newWord: e.target.value
    }));
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleEditSave();
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  const handleEditBlur = () => {
    handleEditSave();
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditingWord(null);
  };

  const handleEditSave = () => {
    if (!editingWord) return;

    const { listId, wordIndex, originalWord, newWord } = editingWord;
    const trimmedNewWord = newWord.trim();

    // If word hasn't changed or is empty, just cancel
    if (!trimmedNewWord || trimmedNewWord === originalWord) {
      setEditingWord(null);
      setIsEditing(false);
      return;
    }

    // Use the context method to update the word by index
    const result = updateWordInList(wordIndex, trimmedNewWord, listId);
    
    if (!result.success) {
      // Handle error - you could show a toast or alert here
      console.error('Failed to update word:', result.message);
      // For now, just keep editing mode active on error
      return;
    }

    setEditingWord(null);
    setIsEditing(false);
  };

  const playSound = (e, wordItem) => {
    e.stopPropagation();
    
    let audioUrl = null;
    
    // Determine audio URL based on language and definition structure
    if (currentLanguage === "en" && wordItem?.audio?.audio_url) {
      audioUrl = wordItem.audio.audio_url;
    } else if (currentLanguage === "es") {
      // Prefer Spanish audio if available, fall back to English
      if (wordItem?.spanish_audio?.audio_url) {
        audioUrl = wordItem.spanish_audio.audio_url;
      } else if (wordItem?.english_audio?.audio_url) {
        audioUrl = wordItem.english_audio.audio_url;
      }
    }
    
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  const handleDeleteWord = (e, listId, word) => {
    e.stopPropagation(); // Prevent card flip when clicking delete

    // Call the removeWordFromList function from context
    const result = removeWordFromList(word, listId);

    // If the deleted word was flipped, remove it from flipped set
    if (result && result.success) {
      const cardId = `${listId}-${word}`;
      setFlippedCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardId);
        return newSet;
      });
    }

    // If the deleted word was being edited, cancel editing
    if (editingWord && editingWord.originalWord === word && editingWord.listId === listId) {
      setEditingWord(null);
    }
  };


  const isWordBeingEdited = (listId, wordIndex) => {
    return editingWord && editingWord.listId === listId && editingWord.wordIndex === wordIndex;
  };

  const isCardFlipped = (cardId) => {
    return flippedCards.has(cardId);
  };

  // Export wordlist to markdown format
  const exportToMarkdown = (list) => {
    let markdown = `# ${list.name}\n\n`;
    
    if (list.words && list.words.length > 0) {
      list.words.forEach((wordItem, index) => {
        markdown += `${wordItem.word},`;

        // Add example phrase if available
        if (wordItem.example_phrase) {
          markdown += ` ${wordItem.example_phrase}`;
        }
        
        markdown += " :: "

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
      // You could show a toast notification here
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
          <div key={list.id} className={styles.wordlist}>
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
                {row.map((wordItem, cardIndex) => {
                  const wordIndex = rowIndex * 3 + cardIndex
                  const cardId = `${list.id}-${wordIndex}`;
                  const isFlipped = isCardFlipped(cardId);
                  
                  return (
                    <div
                      // key={wordItem.word}
                      onClick={(e) => handleCardClick(e, list.id,  wordIndex)}
                      className={`${styles.wordCard} ${isFlipped ? styles.flipped : ''}`}
                    >
                      <div className={styles.cardInner}>
                        {/* Front Face */}
                        <div className={styles.cardFront}>
                          <div className={styles.cardContent}>
                            {/* Editable word title */}
                            <div className={styles.wordTitleContainer}>
                              {isWordBeingEdited(list.id, rowIndex * 3 + cardIndex) ? (
                                <input
                                  ref={editInputRef}
                                  type="text"
                                  value={editingWord.newWord}
                                  onChange={handleEditChange}
                                  onKeyDown={handleEditKeyDown}
                                  onBlur={handleEditBlur}
                                  className={styles.wordEditInput}
                                />
                              ) : (
                                <h3 
                                  className={styles.wordTitle}
                                  onClick={(e) => handleWordClick(e, list.id, wordItem, wordIndex)}
                                  title="Click to edit"
                                >
                                  {wordItem.word}
                                </h3>
                              )}
                            </div>

                            {/* Example phrase */}
                            {wordItem.example_phrase && (
                              <div className={styles.examplePhrase}>
                                <p>{wordItem.example_phrase}</p>
                              </div>
                            )}

                            {/* Card actions */}
                            <div className={styles.cardActions}>
                              {/* Audio button based on unified dictionary structure */}
                              {(currentLanguage === "en" && wordItem?.audio?.audio_url) || 
                               (currentLanguage === "es" && (wordItem?.spanish_audio?.audio_url || wordItem?.english_audio?.audio_url)) ? (
                                <button
                                  onClick={(e) => playSound(e, wordItem)}
                                  className={styles.audioButton}
                                  title="Play pronunciation"
                                >
                                  🔊
                                </button>
                              ) : null}

                              {/* Delete button */}
                              <button
                                onClick={(e) => handleDeleteWord(e, list.id, wordItem.word)}
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