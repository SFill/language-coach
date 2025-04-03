import React, { useRef, useEffect, useState } from 'react';

/**
 * Selection toolbar component for text operations
 * 
 * @param {Object} props - Component props
 * @param {string} props.displayText - Text to display (selected or translated)
 * @param {Function} props.onTranslate - Function for translation
 * @param {Function} props.onSend - Function to send message
 */
const SelectionToolbar = ({ displayText, onTranslate, onSend }) => {
  const spanRef = useRef(null);
  const [isTruncated, setIsTruncated] = useState(false);

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

  return (
    <div className="selection-toolbar">
      <div className="buttons">
        <button onClick={() => onTranslate('ru')}>🇷🇺</button>
        <button onClick={() => onTranslate('en')}>🇺🇸</button>
        <button onClick={() => onTranslate('es')}>🇪🇸</button>
        <button onClick={() => onSend(false)}>Ask a question</button>
        <button onClick={() => onSend(true)}>Send as note</button>
      </div>
      <span
        ref={spanRef}
        className={isTruncated ? 'truncated' : ''}
      >
        {displayText}
      </span>

    </div>
  );
};

export default SelectionToolbar;