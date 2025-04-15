import React, { useState } from "react";
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
    currentLanguage 
  } = useWordlist();
  
  const [expandedState, setExpandedState] = useState({});

  // For each word list, store the currently expanded card (if any)
  // Format: { [listId]: { rowIndex, cardIndex, wordItem } }
  const handleCardClick = (listId, rowIndex, cardIndex, wordItem) => {
    setExpandedState((prev) => {
      // If the same card is clicked again, collapse it.
      if (
        prev[listId] &&
        prev[listId].rowIndex === rowIndex &&
        prev[listId].cardIndex === cardIndex
      ) {
        return { ...prev, [listId]: null };
      }
      // Otherwise, expand this card.
      return { ...prev, [listId]: { rowIndex, cardIndex, wordItem } };
    });
  };

  const playSound = (e, wordItem) => {
    e.stopPropagation();
    
    let audioUrl = null;
    
    // Determine audio URL based on language and definition structure
    if (currentLanguage === "en" && wordItem.definition?.audio?.audio_url) {
      audioUrl = wordItem.definition.audio.audio_url;
    } else if (currentLanguage === "es") {
      // Prefer Spanish audio if available, fall back to English
      if (wordItem.definition?.spanish_audio?.audio_url) {
        audioUrl = wordItem.definition.spanish_audio.audio_url;
      } else if (wordItem.definition?.english_audio?.audio_url) {
        audioUrl = wordItem.definition.english_audio.audio_url;
      }
    }
    
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  const handleDeleteWord = (e, listId, word) => {
    e.stopPropagation(); // Prevent card expansion when clicking delete

    // Call the removeWordFromList function from context
    const result = removeWordFromList(word, listId);

    // If the deleted word was expanded, collapse it
    if (result && result.success) {
      setExpandedState((prev) => {
        if (prev[listId] && prev[listId].wordItem.word === word) {
          return { ...prev, [listId]: null };
        }
        return prev;
      });
    }
  };

  // Helper function to render definitions based on the unified structure
  const renderDefinitionContent = (wordItem) => {
    const def = wordItem.definition;
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
              <React.Fragment key={rowIndex}>
                {/* Render the row of cards as a grid */}
                <div className={styles.cardRow}>
                  {row.map((wordItem, cardIndex) => (
                    <div
                      key={wordItem.word}
                      onClick={() =>
                        handleCardClick(list.id, rowIndex, cardIndex, wordItem)
                      }
                      className={styles.wordCard}
                    >
                      <h3 className={styles.wordTitle}>{wordItem.word}</h3>
                      
                      {/* Audio button based on unified dictionary structure */}
                      {(currentLanguage === "en" && wordItem.definition?.audio?.audio_url) || 
                       (currentLanguage === "es" && (wordItem.definition?.spanish_audio?.audio_url || wordItem.definition?.english_audio?.audio_url)) ? (
                        <button
                          onClick={(e) => playSound(e, wordItem)}
                          className={styles.audioButton}
                        >
                          Play Sound
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
                  ))}
                </div>
                
                {/* Insert a definition row below this row if a card in this row is expanded */}
                {expandedState[list.id] &&
                  expandedState[list.id].rowIndex === rowIndex && (
                    <div className={styles.expandedDefinition}>
                      <div className={styles.definitionContent}>
                        <h4 className={styles.definitionTitle}>
                          {currentLanguage === "en" ? "Definition" : "Translation"} for {expandedState[list.id].wordItem.word}
                        </h4>
                        {renderDefinitionContent(expandedState[list.id].wordItem)}
                      </div>
                    </div>
                  )}
              </React.Fragment>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default WordLists;