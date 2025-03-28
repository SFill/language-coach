import React, { useState, useRef, useEffect } from 'react';
import { translateText } from './api.js';
import './MessageInput.css';

const MessageInputWithToolbar = ({ onSend }) => {
  const [input, setInput] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const textareaRef = useRef(null);

  //  style states
  const [collapsing, setCollapsing] = useState(false);
  const collapseTimeoutRef = useRef(null); // Store timer ID

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
    console.log(end - start)

    // If new text is selected, cancel any pending collapse timeout.
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }

    // If there is a selection, update immediately
    if (sel.length > 0) {
      // Clear any collapsing flag
      setCollapsing(false);
      setSelectedText(sel);
      setTranslatedText('');
    } else if (selectedText) {
      // No selection now, but we had text before → trigger collapse
      setCollapsing(true);
      setTimeout(() => {
        setSelectedText('');
        setTranslatedText('');
        setCollapsing(false);
      }, 600); // duration should match your CSS transition
    }
  };

  const handleTranslate = async (lang) => {
    if (!selectedText.trim()) return;
    const translation = await translateText(selectedText, lang);
    setCollapsing(true);
    setTimeout(() => {
      setTranslatedText(translation);
      setCollapsing(false);
    }, 10); // duration should match your CSS transition
  };
  

  // TODO this is very basic
  // now I want to have option to ask question and send it as note, so senind as note adds whole message to the chat
  // ask question cuts out a selected message from the text area and send to specific endpoint, I will format this message with question answer
  // delete my and his notes
  // tab eq 4 intends
  const handleSend = (isNote = false) => {
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
      handleSend(isNote = true);
    }
  };

  function decodeHTML(html) {
    // to decode nbsp and etc
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  }

  return (
    <div className="message-input">
      <div className="text-area-with-toolbar">
        <div className="selection-toolbar">
          <span className={`${(translatedText || selectedText) ? 'toolbar-text-filled' : ''} ${collapsing ? 'collapsing' : ''}`}>
            {decodeHTML(translatedText || selectedText)}
          </span>
          <div className="buttons">
            <button onClick={() => handleTranslate('ru')}>🇷🇺</button>
            <button onClick={() => handleTranslate('en')}>🇺🇸</button>
            <button onClick={() => handleTranslate('es')}>🇪🇸</button>
            <button onClick={() => handleSend(false)}>Ask a question</button>
            <button onClick={() => handleSend(true)}>Send as note</button>
          </div>
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
