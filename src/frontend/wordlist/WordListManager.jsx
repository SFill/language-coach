import React, { useState } from 'react';
import { normalizePhrase } from './utils'; // from above
import { areCloseMatches } from './utils';  // from above
import { isPartOfPhrase } from './utils';  // from above

// Sample data in memory
const initialLists = [
  {
    id: 1,
    name: 'List A',
    words: [
      { word: 'best', definition: 'Definition of best...' },
      { word: 'run away with someone', definition: 'Definition of run away...' },
    ],
  },
  {
    id: 2,
    name: 'List B',
    words: [
      { word: 'key', definition: 'Definition of key...' },
    ],
  },
];

function WordListsManager() {
  const [lists, setLists] = useState(initialLists);
  const [inputWord, setInputWord] = useState('');
  const [selectedListId, setSelectedListId] = useState(lists[0].id);
  const [message, setMessage] = useState('');

  // Find if the input word is already in any list (exact or close match)
  const findMatch = (newWord) => {
    const normalizedNew = normalizePhrase(newWord);

    for (const list of lists) {
      for (const w of list.words) {
        const normalizedExisting = normalizePhrase(w.word);
        // Exact match
        if (normalizedExisting === normalizedNew) {
          return {
            matchType: 'exact',
            word: w.word,
            listId: list.id,
            listName: list.name,
          };
        }
        // Close match
        if (areCloseMatches(normalizedExisting, normalizedNew)) {
          return {
            matchType: 'close',
            word: w.word,
            listId: list.id,
            listName: list.name,
          };
        }
        // if(isPartOfPhrase(normalizedExisting, normalizedNew)) {
        //   return {
        //     matchType: 'partOfPhrase',
        //     word: w.word,
        //     listId: list.id,
        //     listName: list.name,
        //   };
        // }
      }
    }
    // No match found
    return null;
  };

  const handleAddWord = () => {
    if (!inputWord.trim()) return;

    let messageToSet = `"${inputWord}" added to list ID ${selectedListId}`
    const match = findMatch(inputWord);
    if (match) {
      if (match.matchType === 'exact') {
        messageToSet = 
          `Exact match found in "${match.listName}": "${match.word}". Word not added.`;
        setMessage(messageToSet);
        return;
      } else if (match.matchType === 'close') {
        messageToSet = 
          `Close match found in "${match.listName}": "${match.word}". Word will be added.`;
      } else {
        messageToSet = 
          `Part of phrase match found in "${match.listName}": "${match.word}". Word will be added.`;
      }
    }
    debugger;

    // If no match, add new word to selected list
    const updatedLists = lists.map((list) => {
      if (list.id === selectedListId) {
        return {
          ...list,
          words: [
            ...list.words,
            {
              word: inputWord,
              definition: 'TODO: Provide or fetch definition',
            },
          ],
        };
      }
      return list;
    });

    setLists(updatedLists);
    setMessage(messageToSet);
    setInputWord('');
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Word Lists Manager</h2>
      <div style={{ marginBottom: '1rem' }}>
        <select
          value={selectedListId}
          onChange={(e) => setSelectedListId(Number(e.target.value))}
        >
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          value={inputWord}
          onChange={(e) => setInputWord(e.target.value)}
          placeholder="Enter a word or phrase"
          style={{ width: '300px', marginRight: '8px' }}
        />
        <button onClick={handleAddWord}>Add Word</button>
      </div>

      {message && <div style={{ marginBottom: '1rem' }}>{message}</div>}

      {/* Display lists and words */}
      {lists.map((list) => (
        <div key={list.id} style={{ marginBottom: '1rem' }}>
          <h3>{list.name}</h3>
          <ul>
            {list.words.map((w, index) => (
              <li key={index}>
                <strong>{w.word}</strong> - {w.definition}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default WordListsManager;
