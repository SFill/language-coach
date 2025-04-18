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
  const [activeTab, setActiveTab] = useState('definition');
  const [activeTense, setActiveTense] = useState('presentIndicative');

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
    setActiveTab('definition');

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

  const toggleTab = (tabName) => {
    setActiveTab(tabName);
  };

  const handleTenseClick = (tense) => {
    setActiveTense(tense);
  };

  if (!word) return null;

  // Get audio info based on language
  const hasAudio = currentLanguage === "en" 
    ? !!definition?.audio?.audio_url
    : !!(definition?.spanish_audio?.audio_url || definition?.english_audio?.audio_url);

  // Check if conjugations are available (Spanish only)
  const hasConjugations = currentLanguage === "es" && !!definition?.conjugations;

  // List of available tenses for the navigation
  const tenseLabels = {
    presentIndicative: "Present",
    preteritIndicative: "Preterite",
    imperfectIndicative: "Imperfect",
    conditionalIndicative: "Conditional",
    futureIndicative: "Future",
    presentSubjunctive: "Present Subjunctive",
    imperfectSubjunctive: "Imperfect Subjunctive",
    futureSubjunctive: "Future Subjunctive",
    imperative: "Imperative",
    negativeImperative: "Negative Imperative",
    presentContinuous: "Present Continuous",
    preteritContinuous: "Preterite Continuous",
    imperfectContinuous: "Imperfect Continuous",
    conditionalContinuous: "Conditional Continuous",
    futureContinuous: "Future Continuous",
    presentPerfect: "Present Perfect",
    preteritPerfect: "Preterite Perfect",
    pastPerfect: "Past Perfect",
    conditionalPerfect: "Conditional Perfect",
    futurePerfect: "Future Perfect",
    presentPerfectSubjunctive: "Present Perfect Subjunctive",
    pastPerfectSubjunctive: "Past Perfect Subjunctive",
    futurePerfectSubjunctive: "Future Perfect Subjunctive",
    informalFuture: "Informal Future"
  };

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

      {hasConjugations && (
        <div className={styles.tabs}>
          <button 
            className={`${styles.tabButton} ${activeTab === 'definition' ? styles.activeTab : ''}`}
            onClick={() => toggleTab('definition')}
          >
            Definition
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'conjugation' ? styles.activeTab : ''}`}
            onClick={() => toggleTab('conjugation')}
          >
            Conjugation
          </button>
        </div>
      )}

      <div className={styles.content}>
        {loading && <p>Loading definition...</p>}
        {error && (
          <p className={styles.errorText}>Error fetching definition: {error}</p>
        )}
        
        {definition && activeTab === 'definition' && (
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

            {/* Word matches and definitions */}
            {definition.entries && definition.entries.map((entry, entryIndex) => (
              <div key={entryIndex} className={styles.wordEntry}>
                {/* one of possible matches */}
                <h3>{entry.word}</h3>
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
          </>
        )}

        {/* Conjugation Tab Content */}
        {definition && activeTab === 'conjugation' && hasConjugations && (
          <div className={styles.conjugationContent}>
            <div className={styles.conjugationHeader}>
              <h3>{definition.conjugations.infinitive}</h3>
              <p className={styles.infinitiveTranslation}>{definition.conjugations.translation}</p>
            </div>

            {/* Past Participle & Gerund */}
            {(definition.conjugations.past_participle || definition.conjugations.gerund) && (
              <div className={styles.participleSection}>
                {definition.conjugations.past_participle && definition.conjugations.past_participle.spanish && (
                  <p>
                    <strong>Past Participle:</strong> {definition.conjugations.past_participle.spanish}
                    {definition.conjugations.past_participle.english && ` - ${definition.conjugations.past_participle.english}`}
                  </p>
                )}
                
                {definition.conjugations.gerund && definition.conjugations.gerund.spanish && (
                  <p>
                    <strong>Gerund:</strong> {definition.conjugations.gerund.spanish}
                    {definition.conjugations.gerund.english && ` - ${definition.conjugations.gerund.english}`}
                  </p>
                )}
              </div>
            )}

            {/* Tense Navigation */}
            <div className={styles.tenseNavigation}>
              <select 
                className={styles.tenseSelector}
                value={activeTense}
                onChange={(e) => handleTenseClick(e.target.value)}
              >
                {Object.keys(definition.conjugations.tenses).map(tense => (
                  <option key={tense} value={tense}>
                    {tenseLabels[tense] || tense}
                  </option>
                ))}
              </select>
            </div>

            {/* Current Tense Conjugation Table */}
            {definition.conjugations.tenses[activeTense] && (
              <div className={styles.conjugationTable}>
                <h4>{tenseLabels[activeTense] || activeTense}</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Pronoun</th>
                      <th>Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {definition.conjugations.tenses[activeTense].map((item, idx) => (
                      <tr key={idx}>
                        <td className={styles.pronoun}>{item.pronoun}</td>
                        <td className={styles.forms}>
                          {item.forms && item.forms.length > 0 
                            ? item.forms.join(', ') 
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SideDictionaryPanel;