import React, { useRef, useEffect, useState } from 'react';

/**
 * Selection toolbar component for text operations
 * 
 * @param {Object} props - Component props
 * @param {string} props.displayText - Text to display (selected or translated)
 * @param {Function} props.onTranslate - Function for translation
 * @param {Function} props.onSend - Function to send message
 * @param {string} props.preferredLanguage - Currently active language for translation
 * @param {boolean} props.isTranslating - Flag indicating if translation is in progress
 */
const SelectionToolbar = ({ 
  displayText, 
  onTranslate, 
  onSend, 
  preferredLanguage = null,
  isTranslating = false 
}) => {
  const spanRef = useRef(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [copied, setCopied] = useState(false);

  // Detect if text would be truncated
  useEffect(() => {
    const checkTruncation = () => {
      if (spanRef.current) {
        const isOverflowing = spanRef.current.scrollWidth > spanRef.current.clientWidth;
        setIsTruncated(isOverflowing);
      }
    };

    // Check on initial render and when display text changes
    checkTruncation();

    // Check on window resize
    window.addEventListener('resize', checkTruncation);
    return () => window.removeEventListener('resize', checkTruncation);
  }, [displayText]);
  
  // Function to get button style based on language
  const getButtonStyle = (lang) => {
    if (preferredLanguage === lang) {
      return {
        backgroundColor: '#4CAF50', // Green background for active language
        color: 'white'
      };
    }
    return {}; // Default style for inactive languages
  };

  // Function to handle copying text to clipboard
  const handleCopy = () => {
    if (!displayText || isTranslating) return;
    
    navigator.clipboard.writeText(displayText)
      .then(() => {
        // Show copied indicator
        setCopied(true);
        // Hide the indicator after 2 seconds
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  };

  return (
    <div className="selection-toolbar">
      <div className="buttons">
        <button 
          onClick={() => onTranslate('ru')} 
          style={getButtonStyle('ru')}
          disabled={isTranslating}
        >
          🇷🇺
        </button>
        <button 
          onClick={() => onTranslate('en')} 
          style={getButtonStyle('en')}
          disabled={isTranslating}
        >
          🇺🇸
        </button>
        <button 
          onClick={() => onTranslate('es')} 
          style={getButtonStyle('es')}
          disabled={isTranslating}
        >
          🇪🇸
        </button>
        <button onClick={() => onSend(false)}>Ask a question</button>
        <button onClick={() => onSend(true)}>Send as note</button>
        <button 
          onClick={handleCopy} 
          disabled={!displayText || isTranslating}
          title="Copy to clipboard"
        >
          {copied ? '✓ Copied!' : '📋 Copy'}
        </button>
      </div>
      <span
        ref={spanRef}
        className={isTruncated ? 'truncated' : ''}
      >
        {isTranslating ? 'Translating...' : displayText}
      </span>
    </div>
  );
};

export default SelectionToolbar;