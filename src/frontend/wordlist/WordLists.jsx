import React, { useState } from "react";
import { useWordlist } from "./WordlistContext";

// Helper function to split an array into chunks of the given size
const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

function WordLists() {
  const { wordlists, loading, error, removeWordFromList } = useWordlist();

  // For each word list, store the currently expanded card (if any)
  // Format: { [listId]: { rowIndex, cardIndex, wordItem } }
  const [expanded, setExpanded] = useState({});

  const handleCardClick = (listId, rowIndex, cardIndex, wordItem) => {
    setExpanded((prev) => {
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

  const playSound = (e, audioLink) => {
    e.stopPropagation();
    if (audioLink) {
      const audio = new Audio(audioLink);
      audio.play();
    }
  };

  const handleDeleteWord = (e, listId, word) => {
    e.stopPropagation(); // Prevent card expansion when clicking delete

    // Call the removeWordFromList function from context
    const result = removeWordFromList(word, listId);

    // Optional: show a confirmation or message
    if (result && result.success) {
      // If the deleted word was expanded, collapse it
      setExpanded((prev) => {
        if (prev[listId] && prev[listId].wordItem.word === word) {
          return { ...prev, [listId]: null };
        }
        return prev;
      });
    } else if (result && !result.success) {
      console.error(result.message);
      // Optional: display an error message to the user
    }
  };

  if (loading) return <p>Loading word lists...</p>;
  if (error) return <p>Error fetching word lists: {error}</p>;
  if (!wordlists || wordlists.length === 0) return <p>No word lists available.</p>;

  return (
    <div style={{ padding: "1rem" }}>
      {wordlists.map((list) => {
        // Break the words into rows of 3 cards each.
        const rows = chunkArray(list.words || [], 3);
        return (
          <div key={list.id} style={{ marginBottom: "2rem" }}>
            <h2 style={{ marginBottom: "1rem" }}>
              {list.name}
              {list._isDirty && (
                <span style={{ fontSize: "0.8rem", color: "#777", marginLeft: "0.5rem" }}>
                  (unsaved changes)
                </span>
              )}
            </h2>
            {rows.map((row, rowIndex) => (
              <React.Fragment key={rowIndex}>
                {/* Render the row of cards as a grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "1rem",
                  }}
                >
                  {row.map((wordItem, cardIndex) => (
                    <div
                      key={wordItem.word}
                      onClick={() =>
                        handleCardClick(list.id, rowIndex, cardIndex, wordItem)
                      }
                      style={{
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        padding: "1rem",
                        cursor: "pointer",
                        textAlign: "center",
                        position: "relative",
                      }}
                    >
                      <h3 style={{ margin: 0 }}>{wordItem.word}</h3>
                      {wordItem.definition && wordItem.definition.audio_link && (
                        <button
                          onClick={(e) =>
                            playSound(e, wordItem.definition.audio_link)
                          }
                          style={{ marginTop: "0.5rem" }}
                        >
                          Play Sound
                        </button>
                      )}

                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDeleteWord(e, list.id, wordItem.word)}
                        style={{
                          position: "absolute",
                          top: "0.5rem",
                          right: "0.5rem",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#f44336",
                          fontSize: "1rem",
                          fontWeight: "bold",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "4px",
                        }}
                        title="Delete word"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                {/* Insert a definition row below this row if a card in this row is expanded */}
                {expanded[list.id] &&
                  expanded[list.id].rowIndex === rowIndex && (
                    <div
                      style={{
                        overflow: "hidden",
                        transition: "max-height 0.3s ease, opacity 0.3s ease",
                        maxHeight: "500px",
                        opacity: 1,
                        padding: "1rem",
                        border: "1px solid #eee",
                        marginTop: "1rem",
                        backgroundColor: "#f9f9f9",
                      }}
                    >
                      <div>
                        <h4>
                          Definitions for {expanded[list.id].wordItem.word}
                        </h4>
                        {expanded[list.id].wordItem.definition &&
                          expanded[list.id].wordItem.definition.meanings &&
                          expanded[list.id].wordItem.definition.meanings.map(
                            (meaning, idx) => (
                              <div key={idx} style={{ marginTop: "0.5rem" }}>
                                <p>
                                  <strong>Part of Speech:</strong>{" "}
                                  {meaning.part_of_speech}
                                </p>
                                {meaning.definitions && meaning.definitions.map((defDetail, dIdx) => (
                                  <div key={dIdx} style={{ marginBottom: "0.5rem" }}>
                                    <p>
                                      <strong>Definition:</strong>{" "}
                                      {defDetail.definition}
                                    </p>
                                    {defDetail.example && (
                                      <p>
                                        <em>Example: {defDetail.example}</em>
                                      </p>
                                    )}
                                  </div>
                                ))}
                                {meaning.synonyms && meaning.synonyms.length > 0 && (
                                  <p>
                                    <strong>Synonyms:</strong>{" "}
                                    {meaning.synonyms.join(", ")}
                                  </p>
                                )}
                                {meaning.antonyms && meaning.antonyms.length > 0 && (
                                  <p>
                                    <strong>Antonyms:</strong>{" "}
                                    {meaning.antonyms.join(", ")}
                                  </p>
                                )}
                              </div>
                            )
                          )}
                        {(!expanded[list.id].wordItem.definition ||
                          !expanded[list.id].wordItem.definition.meanings ||
                          expanded[list.id].wordItem.definition.meanings.length === 0) && (
                            <p>No detailed definition available.</p>
                          )}
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