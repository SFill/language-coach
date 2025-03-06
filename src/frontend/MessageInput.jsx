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
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // When the user selects text, update the selectedText and clear any previous translation.
  const handleSelect = (e) => {
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const sel = input.substring(start, end);
    setSelectedText(sel);
    setTranslatedText('');
  };

  // When a translation button is pressed, always translate using the originally selected text.
  const handleTranslate = async (lang) => {
    if (!selectedText.trim()) return;
    const translation = await translateText(selectedText, lang);
    setTranslatedText(translation);
  };

  const handleSend = () => {
    if (input.trim()) {
      onSend(input);
      setInput('');
      setSelectedText('');
      setTranslatedText('');
    }
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
        {/* Toolbar is always visible above the textarea */}
        <div className="selection-toolbar" style={{ marginBottom: '10px', padding: '5px', border: '1px solid #ccc', background: '#f9f9f9' }}>
          <span style={{ marginRight: '10px' }}>
            {translatedText || selectedText}
          </span>
          <button onClick={() => handleTranslate('ru')}>ru</button>
          <button onClick={() => handleTranslate('en')}>en</button>
          <button onClick={() => handleTranslate('es')}>es</button>
        </div>

        {/* Text area for message input */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onSelect={handleSelect}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          rows={3}
        />
      </div>
      <button onClick={handleSend}>Send</button>
    </div>
  );
};

export default MessageInputWithToolbar;
