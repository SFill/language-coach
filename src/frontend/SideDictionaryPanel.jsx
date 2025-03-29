import React, { useState, useEffect } from "react";
import { getWordDefinition } from "./api";
import "./SideDictionaryPanel.css";

import axios from "axios";

/**
 * EnglishWordDefinition shape:
 * {
 *   audio_link: string | null;
 *   english_dialect: "us" | "uk";
 *   meanings: [
 *     {
 *       part_of_speech: string;
 *       definitions: [
 *         {
 *           definition: string;
 *           synonyms: string[];
 *           antonyms: string[];
 *           example?: string;
 *         }
 *       ];
 *       synonyms: string[];
 *       antonyms: string[];
 *     }
 *   ];
 * }
 *
 * This component expects an API endpoint:
 *   GET /api/words/{word}
 * that returns an EnglishWordDefinition object.
 */

const SideDictionaryPanel = ({ word, onClose }) => {
  const [definition, setDefinition] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!word) {
      setDefinition(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setDefinition(null);

    getWordDefinition(word)
      .then((data) => {
        setDefinition(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [word]);

  const handlePlaySound = () => {
    if (definition?.audio_link) {
      const audio = new Audio(definition.audio_link);
      audio.play();
    }
  };

  if (!word) return null;

  return (
    <div className="side-dictionary-panel">
      <div className="side-dictionary-header">
        <h2>{word}</h2>
        <button className="close-button" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="side-dictionary-content">
        {loading && <p>Loading definition...</p>}
        {error && (
          <p className="error-text">Error fetching definition: {error.message}</p>
        )}
        {definition && (
          <>
            {definition.audio_link && (
              <button className="audio-button" onClick={handlePlaySound}>
                ► Play Audio
              </button>
            )}

            <p className="dialect-info">
              Dialect: {definition.english_dialect.toUpperCase()}
            </p>

            {definition.meanings.map((meaning, idx) => (
              <div key={idx} className="meaning">
                <h4>{meaning.part_of_speech}</h4>
                {meaning.definitions.map((defDetail, dIdx) => (
                  <div key={dIdx} className="definition-detail">
                    <p>
                      <strong>Definition:</strong> {defDetail.definition}
                    </p>
                    {defDetail.example && (
                      <p className="example">Example: {defDetail.example}</p>
                    )}
                    {defDetail.synonyms && defDetail.synonyms.length > 0 && (
                      <p>
                        <strong>Synonyms:</strong> {defDetail.synonyms.join(", ")}
                      </p>
                    )}
                    {defDetail.antonyms && defDetail.antonyms.length > 0 && (
                      <p>
                        <strong>Antonyms:</strong> {defDetail.antonyms.join(", ")}
                      </p>
                    )}
                  </div>
                ))}

                {meaning.synonyms.length > 0 && (
                  <p>
                    <strong>Synonyms:</strong> {meaning.synonyms.join(", ")}
                  </p>
                )}
                {meaning.antonyms.length > 0 && (
                  <p>
                    <strong>Antonyms:</strong> {meaning.antonyms.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default SideDictionaryPanel;
