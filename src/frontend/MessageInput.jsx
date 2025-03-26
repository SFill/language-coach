import React, { useState, useRef, useEffect } from 'react';
import { translateText } from './api.js';
import './MessageInput.css';

const MessageInputWithToolbar = ({ onSend }) => {
  const [input, setInput] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const textareaRef = useRef(null);

  // Auto-resize the textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const prevScrollPosition = window.scrollY;
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
      // prevent from auto scrolling when input text  
      window.scrollTo({ top: prevScrollPosition, behavior: 'instant' });
    }
  }, [input]);

  const handleSelect = (e) => {
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const sel = input.substring(start, end);
    setSelectedText(sel);
    setTranslatedText('');
  };

  const handleTranslate = async (lang) => {
    if (!selectedText.trim()) return;
    const translation = await translateText(selectedText, lang);
    setTranslatedText(translation);
  };

  const handleSend = (isNote=false) => {
    if (!selectedText.trim()) return;

    onSend(selectedText, isNote);
    // setInput('');
    setSelectedText('');
    setTranslatedText('');
  };

  const handleKeyDown = (e) => {
    // Allow Enter to insert a newline; send message on Ctrl + Enter
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="message-input">
      <div className="text-area-with-toolbar">
        <div className="selection-toolbar">
          <span style={{ marginRight: '10px' }}>
            {translatedText || selectedText}
          </span>
          <button onClick={() => handleTranslate('ru')}>ru</button>
          <button onClick={() => handleTranslate('en')}>en</button>
          <button onClick={() => handleTranslate('es')}>es</button>
          <button onClick={handleSend}>Send</button>
          <button onClick={()=> handleSend(true)}>Send as note</button>
        </div>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onSelect={handleSelect}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          rows={1} // start small, it will grow
        />
      </div>
    </div>
  );
};

export default MessageInputWithToolbar;
