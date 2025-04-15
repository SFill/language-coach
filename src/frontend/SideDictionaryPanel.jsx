import React, { useState, useEffect } from "react";
import { getWordDefinition } from "./api";
import { useWordlist } from "./wordlist/WordlistContext";
import styles from "./SideDictionaryPanel.module.css";

/**
 * Unified Dictionary Panel component that supports both English and Spanish definitions
 * with the new unified model structure, using language from WordlistContext.
 */
const SideDictionaryPanel = ({ word, onClose }) => {
  const { currentLanguage } = useWordlist();
  const [definition, setDefinition] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConjugations, setShowConjugations] = useState(false);

  useEffect(() => {
    if (!word) {
      setDefinition(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setDefinition(null);
    setShowConjugations(false);

    // Use language from context and include conjugations for Spanish
    getWordDefinition(word, currentLanguage, currentLanguage === "es")
      .then((data) => {
        setDefinition(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.toString());
        setLoading(false);
      });
  }, [word, currentLanguage]);

  const handlePlaySound = () => {
    let audioUrl = null;
    
    // Handle different audio structures based on language
    if (currentLanguage === "en" && definition?.audio?.audio_url) {
      audioUrl = definition.audio.audio_url;
    } else if (currentLanguage === "es") {
      // Prefer Spanish audio if available, fall back to English
      if (definition?.spanish_audio?.audio_url) {
        audioUrl = definition.spanish_audio.audio_url;
      } else if (definition?.english_audio?.audio_url) {
        audioUrl = definition.english_audio.audio_url;
      }
    }
    
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  const toggleConjugations = () => {
    setShowConjugations(!showConjugations);
  };

  if (!word) return null;

  // Get audio info based on language
  const hasAudio = currentLanguage === "en" 
    ? !!definition?.audio?.audio_url
    : !!(definition?.spanish_audio?.audio_url || definition?.english_audio?.audio_url);

  // Check if conjugations are available (Spanish only)
  const hasConjugations = currentLanguage === "es" && !!definition?.conjugations;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2>{word}</h2>
        <div className={styles.headerControls}>
          <span className={styles.languageBadge}>
            {currentLanguage === "en" ? "EN" : "ES"}
          </span>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {loading && <p>Loading definition...</p>}
        {error && (
          <p className={styles.errorText}>Error fetching definition: {error}</p>
        )}
        
        {definition && (
          <>
            {/* Audio button */}
            {hasAudio && (
              <button className={styles.audioButton} onClick={handlePlaySound}>
                ► Play Audio
              </button>
            )}

            {/* Dialect info (English only) */}
            {currentLanguage === "en" && definition.dialect && (
              <p className={styles.dialectInfo}>
                Dialect: {definition.dialect.toUpperCase()}
              </p>
            )}

            {/* Word definitions */}
            {definition.entries && definition.entries.map((entry, entryIndex) => (
              <div key={entryIndex} className={styles.wordEntry}>
                {/* POS Groups */}
                {entry.pos_groups && entry.pos_groups.map((posGroup, posIndex) => (
                  <div key={posIndex} className={styles.meaning}>
                    <h4>{posGroup.pos}</h4>
                    
                    {/* Senses */}
                    {posGroup.senses && posGroup.senses.map((sense, senseIndex) => (
                      <div key={senseIndex} className={styles.definitionDetail}>
                        {/* For English, the context_en contains the definition */}
                        {currentLanguage === "en" && sense.context_en && (
                          <p><strong>Definition:</strong> {sense.context_en}</p>
                        )}
                        
                        {/* For Spanish, display context if available */}
                        {currentLanguage === "es" && sense.context_en && (
                          <p><strong>Context:</strong> {sense.context_en}</p>
                        )}
                        
                        {/* Translations */}
                        {sense.translations && sense.translations.map((translation, transIndex) => (
                          <div key={transIndex} className={styles.translation}>
                            {/* In Spanish, translation.translation contains the actual translation */}
                            {currentLanguage === "es" && translation.translation && (
                              <p><strong>Translation:</strong> {translation.translation}</p>
                            )}
                            
                            {/* Examples */}
                            {translation.examples && translation.examples.length > 0 && (
                              <div className={styles.examples}>
                                <p><strong>Examples:</strong></p>
                                {translation.examples.map((example, exampleIndex) => (
                                  <div key={exampleIndex} className={styles.example}>
                                    <p className={styles.source}>{example.source_text}</p>
                                    {example.source_text !== example.target_text && (
                                      <p className={styles.target}>{example.target_text}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        
                        {/* Synonyms and Antonyms */}
                        {sense.synonyms && sense.synonyms.length > 0 && (
                          <p>
                            <strong>Synonyms:</strong> {sense.synonyms.join(", ")}
                          </p>
                        )}
                        {sense.antonyms && sense.antonyms.length > 0 && (
                          <p>
                            <strong>Antonyms:</strong> {sense.antonyms.join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}

            {/* Conjugations (Spanish only) */}
            {hasConjugations && (
              <div className={styles.conjugationsSection}>
                <button 
                  className={styles.toggleConjugationsButton}
                  onClick={toggleConjugations}
                >
                  {showConjugations ? "Hide" : "Show"} Conjugations
                </button>
                
                {showConjugations && (
                  <div className={styles.conjugations}>
                    <h3>Conjugations</h3>
                    <p>
                      <strong>Infinitive:</strong> {definition.conjugations.infinitive} - {definition.conjugations.translation}
                    </p>
                    
                    {/* Past Participle */}
                    {definition.conjugations.past_participle && (
                      <p>
                        <strong>Past Participle:</strong> {definition.conjugations.past_participle.spanish} - {definition.conjugations.past_participle.english}
                      </p>
                    )}
                    
                    {/* Gerund */}
                    {definition.conjugations.gerund && (
                      <p>
                        <strong>Gerund:</strong> {definition.conjugations.gerund.spanish} - {definition.conjugations.gerund.english}
                      </p>
                    )}
                    
                    {/* Tenses */}
                    {Object.entries(definition.conjugations.tenses).map(([tenseName, tenseData], tenseIndex) => (
                      <div key={tenseIndex} className={styles.tense}>
                        <h4>{tenseName}</h4>
                        <table className={styles.conjugationTable}>
                          <tbody>
                            {Object.entries(tenseData).map(([pronoun, conjugation], pronounIndex) => (
                              <tr key={pronounIndex}>
                                <td className={styles.pronoun}>{pronoun}</td>
                                <td className={styles.forms}>{conjugation.forms.join(', ')}</td>
                                <td className={styles.translationCell}>{conjugation.translation}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SideDictionaryPanel;