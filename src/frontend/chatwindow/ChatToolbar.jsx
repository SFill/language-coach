import React from 'react';
import './ChatToolbar.css';

const ChatToolbar = ({ 
  toolbarRef,
  style, 
  handleTranslate, 
  handleRollback, 
  showDictionaryButton, 
  checkInDictionary, 
  showRollback,
  isVisible,
}) => {
  
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