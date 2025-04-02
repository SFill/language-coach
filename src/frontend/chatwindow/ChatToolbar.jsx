import React, { useRef, useEffect } from 'react';
import './ChatToolbar.css';

const ChatToolbar = ({ 
  style, 
  handleTranslate, 
  handleRollback, 
  showDictionaryButton, 
  checkInDictionary, 
  showRollback,
  isVisible,
  setIsVisible
}) => {
  const toolbarRef = useRef(null);
  
  useEffect(() => {
    // Global click handler
    const handleGlobalClick = (e) => {
      if (!toolbarRef.current) return;
      
      // Don't close if clicking on toolbar itself
      if (toolbarRef.current.contains(e.target)) {
        return;
      }
      
      
      // Don't close if clicking on a translated span
      const isTranslatedSpan = isClickOnTranslatedText(e.target);
      if (isTranslatedSpan) {
        return;
      }
      
      // Hide toolbar for all other clicks
      setIsVisible(false);
    };
    
    // Add global listener when toolbar is visible
    if (isVisible) {
      document.addEventListener('mouseup', handleGlobalClick);
    }
    
    // Clean up
    return () => {
      document.removeEventListener('mouseup', handleGlobalClick);
    };
  }, [isVisible, setIsVisible]);
  
  // Helper to check if click is on translated text
  const isClickOnTranslatedText = (element) => {
    let current = element;
    
    // Walk up the DOM tree to find translated spans
    while (current) {
      if (
        current.tagName === 'SPAN' && 
        current.getAttribute('data-translated') === 'true'
      ) {
        return true;
      }
      current = current.parentElement;
    }
    
    return false;
  };
  
  const onClickHandler = (e) => {
    e.stopPropagation();
  };
  
  // If not visible, don't render
  if (!isVisible) {
    return null;
  }
  
  return (
    <div 
      className="chat-toolbar" 
      style={style} 
      onClick={onClickHandler}
      ref={toolbarRef}
    >
      <button onClick={() => handleTranslate('ru')}>ru</button>
      <button onClick={() => handleTranslate('en')}>en</button>
      <button onClick={() => handleTranslate('es')}>es</button>
      {showDictionaryButton() && (
        <button onClick={checkInDictionary} className="dictionary-button"></button>
      )}
      {showRollback && (
        <button onClick={handleRollback} className="rollback-button">
          Rollback
        </button>
      )}
    </div>
  );
};

export default ChatToolbar;