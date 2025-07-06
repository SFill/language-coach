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

  // Helper function to render definitions based on the unified structure
  const renderDefinitionContent = (wordItem) => {
    const def = wordItem;
    if (!def) return <p>No definition available.</p>;
    
    // Check for the new unified structure (entries with pos_groups)
    if (def.entries && Array.isArray(def.entries)) {
      return (
        <>
          {def.entries.map((entry, entryIndex) => (
            <div key={entryIndex} className={styles.definitionEntry}>
              {/* POS Groups */}
              {entry.pos_groups && entry.pos_groups.map((posGroup, posIndex) => (
                <div key={posIndex} className={styles.posGroup}>
                  <h5 className={styles.partOfSpeech}>{posGroup.pos}</h5>
                  
                  {/* Senses */}
                  {posGroup.senses && posGroup.senses.map((sense, senseIndex) => (
                    <div key={senseIndex} className={styles.sense}>
                      {/* Context/Definition */}
                      {currentLanguage === "en" && sense.context_en && (
                        <p className={styles.definition}>
                          <span className={styles.definitionNumber}>{senseIndex + 1}.</span> {sense.context_en}
                        </p>
                      )}
                      
                      {/* Translations (Spanish) */}
                      {currentLanguage === "es" && sense.translations && sense.translations.map((translation, transIndex) => (
                        <div key={transIndex} className={styles.translation}>
                          {translation.translation && (
                            <p className={styles.translationText}>
                              <span className={styles.definitionNumber}>{senseIndex + 1}.{transIndex + 1}</span> {translation.translation}
                            </p>
                          )}
                          
                          {/* Examples */}
                          {translation.examples && translation.examples.length > 0 && (
                            <div className={styles.examples}>
                              {translation.examples.map((example, exIndex) => (
                                <div key={exIndex} className={styles.example}>
                                  <p className={styles.sourceText}>{example.source_text}</p>
                                  {example.source_text !== example.target_text && (
                                    <p className={styles.targetText}>{example.target_text}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {/* Synonyms and Antonyms */}
                      {sense.synonyms && sense.synonyms.length > 0 && (
                        <p className={styles.synonyms}>
                          <strong>Synonyms:</strong> {sense.synonyms.join(", ")}
                        </p>
                      )}
                      {sense.antonyms && sense.antonyms.length > 0 && (
                        <p className={styles.antonyms}>
                          <strong>Antonyms:</strong> {sense.antonyms.join(", ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </>
      );
    }
    
    return <p>No detailed definition available.</p>;
  };

  const isWordBeingEdited = (listId, wordIndex) => {
    return editingWord && editingWord.listId === listId && editingWord.wordIndex === wordIndex;
  };

  const isCardFlipped = (cardId) => {
    return flippedCards.has(cardId);
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
                            <div className={styles.definitionContainer}>
                              <h4 className={styles.backTitle}>
                                {currentLanguage === "en" ? "Definition" : "Translation"}
                              </h4>
                              <div className={styles.definitionContent}>
                                {renderDefinitionContent(wordItem)}
                              </div>
                            </div>
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