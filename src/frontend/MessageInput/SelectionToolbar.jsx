import React from 'react';

/**
 * Selection toolbar component for text operations
 * 
 * @param {Object} props - Component props
 * @param {string} props.displayText - Text to display (selected or translated)
 * @param {Function} props.onTranslate - Function for translation
 * @param {Function} props.onSend - Function to send message
 */
const SelectionToolbar = ({ displayText, onTranslate, onSend }) => {
  return (
    <div className="selection-toolbar">
      <span>{displayText}</span>
      <div className="buttons">
        <button onClick={() => onTranslate('ru')}>🇷🇺</button>
        <button onClick={() => onTranslate('en')}>🇺🇸</button>
        <button onClick={() => onTranslate('es')}>🇪🇸</button>
        <button onClick={() => onSend(false)}>Ask a question</button>
        <button onClick={() => onSend(true)}>Send as note</button>
      </div>
    </div>
  );
};

export default SelectionToolbar;