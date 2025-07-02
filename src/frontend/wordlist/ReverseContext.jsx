import React, { useState } from 'react';
import { fetchSentenceExamples } from '../api';
import styles from './ReverseContext.module.css';

function ReverseContext() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sentences, setSentences] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [language, setLanguage] = useState('en');
  const [proficiency, setProficiency] = useState('intermediate');

  // Fetch sentences matching `searchTerm`
  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setSentences([]);
    
    try {
      const data = await fetchSentenceExamples(
        searchTerm.trim(),
        language,
        5,
        proficiency
      );
      
      setSentences(data);
      
      if (data.length === 0) {
        setError(`No sentences found containing "${searchTerm}"`);
      }
    } catch (err) {
      console.error('Error fetching sentences:', err);
      setError('Network error or server is unavailable');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press in search input
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Highlight the search term in the sentence
  const highlightSearchTerm = (sentence, term) => {
    if (!term.trim()) return sentence;
    
    // Simple case-insensitive split with regex
    const parts = sentence.split(new RegExp(`(${term})`, 'gi'));
    
    return parts.map((part, i) => 
      part.toLowerCase() === term.toLowerCase() 
        ? <mark key={i}>{part}</mark> 
        : part
    );
  };

  return (
    <div className={styles.container}>
      <h2>Example Sentence Search</h2>
      
      {/* Options for language and proficiency */}
      <div className={styles.searchOptions}>
        <div className={styles.optionGroup}>
          <label htmlFor="language-select">Language:</label>
          <select 
            id="language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
          </select>
        </div>
        
        <div className={styles.optionGroup}>
          <label htmlFor="proficiency-select">Level:</label>
          <select 
            id="proficiency-select"
            value={proficiency}
            onChange={(e) => setProficiency(e.target.value)}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>
      
      {/* Search input + button */}
      <div className={styles.searchBar}>
        <input
          type="text"
          value={searchTerm}
          placeholder="Enter a word or phrase to search"
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={handleKeyPress}
          className={styles.searchInput}
        />
        <button 
          onClick={handleSearch}
          disabled={isLoading || !searchTerm.trim()}
          className={styles.searchButton}
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className={styles.loadingIndicator}>
          Searching for examples...
        </div>
      )}

      {/* Display results */}
      {sentences.length > 0 && (
        <div className={styles.resultsContainer}>
          <h3>Example Sentences</h3>
          
          {sentences.map((item, index) => (
            <div key={index} className={styles.sentenceCard}>
              <div className={styles.sentenceText}>
                {highlightSearchTerm(item.sentence, searchTerm)}
              </div>
              
              <div className={styles.sentenceMeta}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Source:</span>
                  <span className={styles.metaValue}>{item.title || 'Unknown'}</span>
                </div>
                
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Category:</span>
                  <span className={styles.metaValue}>{item.category || 'Uncategorized'}</span>
                </div>
                
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Quality Score:</span>
                  <span className={styles.metaValue}>
                    {(item.score * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* No results message */}
      {!isLoading && sentences.length === 0 && searchTerm && !error && (
        <div className={styles.noResults}>
          No example sentences found for "{searchTerm}".
        </div>
      )}
    </div>
  );
}

export default ReverseContext;