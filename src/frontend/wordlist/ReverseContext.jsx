import React, { useState } from 'react';

function ReverseContext() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sentences, setSentences] = useState([]);
  const [selectedWordInfo, setSelectedWordInfo] = useState(null);

  // A small helper to convert the Hepple POS tag into something more descriptive
  // (this is optional — you can adjust as desired)
  const heppleToHuman = (msd) => {
    switch (msd) {
      case 'NN':
        return 'Noun (singular)';
      case 'NNS':
        return 'Noun (plural)';
      case 'NNP':
        return 'Proper noun';
      case 'JJ':
        return 'Adjective';
      case 'VB':
        return 'Verb (base form)';
      case 'VBG':
        return 'Verb (gerund)';
      case 'RB':
        return 'Adverb';
      case 'CC':
        return 'Coordinating conjunction';
      case 'DT':
        return 'Determiner';
      case 'IN':
        return 'Preposition';
      case 'PRP$':
        return 'Possessive pronoun';
      case 'CD':
        return 'Cardinal number';
      default:
        return msd; // fallback to raw tag
    }
  };

  // Fetch sentences matching `searchTerm`
  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSelectedWordInfo(null);
    try {
      const resp = await fetch(`http://localhost:8000/api/coach/index/words/${searchTerm.trim()}`);
      if (!resp.ok) {
        // E.g. 404 "word not found", etc.
        alert('No sentences found or error fetching data');
        return;
      }
      const data = await resp.json();
      // data is an array of { id, sentence, meta: [...] }
      setSentences(data);
    } catch (err) {
      console.error('Error fetching sentences:', err);
      alert('Error fetching sentences');
    }
  };

  // Handle clicking a token. We'll show the meta info in a little “details” area.
  const handleTokenClick = (tokenMeta) => {
    if (!tokenMeta) return;
    setSelectedWordInfo(tokenMeta);
  };

  return (
    <div style={{ marginTop: '2rem' }}>
      <h2>Reverse Context</h2>
      {/* Search input + button */}
      <div style={{ display: 'flex', marginBottom: '1rem' }}>
        <input
          type="text"
          value={searchTerm}
          placeholder="Enter a word to search"
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, marginRight: '0.5rem', padding: '0.5rem' }}
        />
        <button onClick={handleSearch}>Search</button>
      </div>

      {/* Display results */}
      <div>
        {sentences.map((item) => {
          // Split the sentence into array of tokens by whitespace
          const tokens = item.sentence.split(/\s+/);
          
          return (
            <div key={item.id} style={{ marginBottom: '1.5rem' }}>
              <p>
                <strong>Sentence ID:</strong> {item.id}
              </p>
              {/* Build clickable tokens. 
                  Assume item.meta.length === tokens.length (approx). 
                  If not, handle carefully. 
               */}
              <div style={{ lineHeight: '1.5' }}>
                {tokens.map((word, idx) => {
                  const wordMeta = item.meta[idx]; // match by index
                  return (
                    <span
                      key={idx}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: '#f8f8f8',
                        borderRadius: '4px',
                        padding: '0 3px',
                        marginRight: '3px',
                      }}
                      onClick={() => handleTokenClick(wordMeta)}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* If user clicked on a token, show details */}
      {selectedWordInfo && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: '#fafafa',
          }}
        >
          <h4>Word Details</h4>
          <p>
            <strong>Base form:</strong> {selectedWordInfo.base}
          </p>
          {selectedWordInfo.affix && (
            <p>
              <strong>Affix:</strong> {selectedWordInfo.affix}
            </p>
          )}
          <p>
            <strong>Part of Speech (Hepple):</strong> {selectedWordInfo.msd}
          </p>
          <p>
            <strong>Human-readable:</strong> {heppleToHuman(selectedWordInfo.msd)}
          </p>
          <p>
            <strong>Sentence start/end indices:</strong> {selectedWordInfo.s_l} - {selectedWordInfo.s_r}
          </p>
        </div>
      )}
    </div>
  );
}

export default ReverseContext;
