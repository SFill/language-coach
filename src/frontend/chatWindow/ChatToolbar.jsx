import React from 'react';
import './ChatToolbar.css';

const ChatToolbar = ({ style, handleTranslate, handleRollback, showDictionaryButton, checkInDictionary, showRollback }) => {
  const onClickHandler = (e) => {
    e.stopPropagation();
  };
  
  return (
    <div className="chat-toolbar" style={style} onClick={onClickHandler}>
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
