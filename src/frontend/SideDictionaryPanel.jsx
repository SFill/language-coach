import React, { useState, useEffect } from "react";
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

    // Optionally, change the baseURL if you have a custom config
    // Use a base URL that covers the /api/coach prefix.
    const API_BASE_URL = import.meta.env.VITE_ENVIRONMENT === 'dev' ? 'http://localhost:8000/api/' : 'http://localhost/api/';

    const api = axios.create({
        baseURL: API_BASE_URL,
        headers: { 'Content-Type': 'application/json' },
    });

    useEffect(() => {
        if (!word) {
            // If no word is set, clear old data
            setDefinition(null);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);
        setDefinition(null);

        api
            .get(`words/${word}`)
            .then((res) => {
                setDefinition(res.data);
                setLoading(false);
            })
            .catch((err) => {
                setError(err);
                setLoading(false);
            });
    }, [word]);

    // Play sound if an audio_link is present
    const handlePlaySound = () => {
        if (definition?.audio_link) {
            const audio = new Audio(definition.audio_link);
            audio.play();
        }
    };

    // If no word is provided, do not render the panel at all
    if (!word) return null;

    // Panel container styling
    const panelStyles = {
        width: "100%",
        backgroundColor: "#fff",
        boxShadow: "0 0 12px rgba(0,0,0,0.1)",
        display: "flex",
        flexDirection: "column",
    };

    // Header styling
    const headerStyles = {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1rem",
        borderBottom: "1px solid #eee",
    };

    // Content styling
    const contentStyles = {
        flex: 1,
        overflowY: "auto",
        padding: "1rem",
    };

    return (
        <div style={panelStyles}>
            {/* Header with word and close button */}
            <div style={headerStyles}>
                <h2 style={{ margin: 0 }}>{word}</h2>
                <button onClick={onClose} style={{ cursor: "pointer" }}>
                    ✕
                </button>
            </div>

            {/* Content Area */}
            <div style={contentStyles}>
                {loading && <p>Loading definition...</p>}
                {error && (
                    <p style={{ color: "red" }}>
                        Error fetching definition: {error.message}
                    </p>
                )}
                {definition && (
                    <>
                        {/* Audio button if available */}
                        {definition.audio_link && (
                            <button
                                onClick={handlePlaySound}
                                style={{
                                    display: "block",
                                    marginBottom: "1rem",
                                    cursor: "pointer",
                                }}
                            >
                                ► Play Audio
                            </button>
                        )}

                        {/* Dialect info (us / uk) */}
                        <p style={{ fontStyle: "italic", color: "#888" }}>
                            Dialect: {definition.english_dialect.toUpperCase()}
                        </p>

                        {/* Render the array of meanings */}
                        {definition.meanings.map((meaning, idx) => (
                            <div
                                key={idx}
                                style={{
                                    marginBottom: "1rem",
                                    paddingBottom: "1rem",
                                    borderBottom: "1px solid #eee",
                                }}
                            >
                                <h4 style={{ margin: "0 0 0.25rem 0" }}>
                                    {meaning.part_of_speech}
                                </h4>

                                {/* Each meaning can have multiple definitions */}
                                {meaning.definitions.map((defDetail, dIdx) => (
                                    <div
                                        key={dIdx}
                                        style={{
                                            marginBottom: "0.75rem",
                                            paddingLeft: "0.5rem",
                                            borderLeft: "3px solid #ddd",
                                        }}
                                    >
                                        <p style={{ margin: "0.25rem 0" }}>
                                            <strong>Definition:</strong> {defDetail.definition}
                                        </p>
                                        {defDetail.example && (
                                            <p style={{ margin: "0.25rem 0", fontStyle: "italic" }}>
                                                Example: {defDetail.example}
                                            </p>
                                        )}
                                        {/* If there are synonyms or antonyms at the definition level */}
                                        {defDetail.synonyms && defDetail.synonyms.length > 0 && (
                                            <p style={{ margin: "0.25rem 0" }}>
                                                <strong>Synonyms:</strong> {defDetail.synonyms.join(", ")}
                                            </p>
                                        )}
                                        {defDetail.antonyms && defDetail.antonyms.length > 0 && (
                                            <p style={{ margin: "0.25rem 0" }}>
                                                <strong>Antonyms:</strong> {defDetail.antonyms.join(", ")}
                                            </p>
                                        )}
                                    </div>
                                ))}

                                {/* synonyms/antonyms at the "meaning" level */}
                                {meaning.synonyms.length > 0 && (
                                    <p style={{ margin: "0.25rem 0" }}>
                                        <strong>Synonyms:</strong> {meaning.synonyms.join(", ")}
                                    </p>
                                )}
                                {meaning.antonyms.length > 0 && (
                                    <p style={{ margin: "0.25rem 0" }}>
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
