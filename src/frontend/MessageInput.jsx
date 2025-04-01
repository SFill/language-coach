import React, { useState, useRef, useEffect } from 'react';
import { translateText } from './api.js';
import './MessageInput.css';

const LOCAL_STORAGE_KEY = 'language-coach-message-input';

const MessageInputWithToolbar = ({ onSend }) => {
  const [input, setInput] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const textareaRef = useRef(null);

  // Load saved input text from localStorage when component mounts
  useEffect(() => {
    const savedInput = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedInput) {
      setInput(savedInput);
    }
  }, []);

  // Save input text to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, input);
  }, [input]);

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
    if (sel.length > 0) {
      setSelectedText(sel);
      setTranslatedText('');
    }
  };

  const handleTranslate = async (lang) => {
    if (!selectedText.trim()) return;
    const translation = await translateText(selectedText, lang);
    setTranslatedText(translation);
  };

  const handleSend = (isNote = false) => {
    if (!selectedText.trim()) return;

    onSend(selectedText, isNote);

    if (isNote) setInput('');
    setSelectedText('');
    setTranslatedText('');
  };

  // Handle keyboard events for formatting shortcuts and hotkeys
  const handleKeyDown = (e) => {
    // Tab key - insert 4 spaces instead of changing focus
    if (e.key === 'Tab') {
      e.preventDefault();

      const textarea = textareaRef.current;
      const startPos = textarea.selectionStart;
      const endPos = textarea.selectionEnd;

      // Insert 4 spaces at the cursor position
      const newText = input.substring(0, startPos) + '    ' + input.substring(endPos);
      setInput(newText);

      // Set cursor position after the inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = startPos + 4;
      }, 0);
    }

    // Backspace key in translation area - clear translation
    else if (e.key === 'Backspace' && (translatedText || selectedText)) {
      // e.preventDefault();
      setTranslatedText('');
      setSelectedText('');
    }
    // Ctrl + E: clear translate
    else if (e.key === 'e' && e.ctrlKey) {
      e.preventDefault();
      setTranslatedText('');
      setSelectedText('');
    }

    // Ctrl + Enter to send as note
    else if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSend(true);
    }

    // Markdown shortcuts
    // Bold: Ctrl+B
    else if (e.key === 'b' && e.ctrlKey) {
      e.preventDefault();
      applyMarkdownFormatting('**', '**');
    }
    // Italic: Ctrl+I
    else if (e.key === 'i' && e.ctrlKey) {
      e.preventDefault();
      applyMarkdownFormatting('*', '*');
    }
    // Code: Ctrl+K
    else if (e.key === 'k' && e.ctrlKey) {
      e.preventDefault();
      applyMarkdownFormatting('`', '`');
    }
  };

  // Helper function for applying markdown formatting
  const applyMarkdownFormatting = (prefix, suffix) => {
    const textarea = textareaRef.current;
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;

    if (startPos === endPos) {
      // No selection, just insert the markers and place cursor between them
      const newText = input.substring(0, startPos) + prefix + suffix + input.substring(endPos);
      setInput(newText);

      // Place cursor between the markers
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = startPos + prefix.length;
      }, 0);
    } else {
      // Text is selected, wrap it with the markers
      const selectedText = input.substring(startPos, endPos);
      const newText = input.substring(0, startPos) + prefix + selectedText + suffix + input.substring(endPos);
      setInput(newText);

      // Select the text including the markers
      setTimeout(() => {
        textarea.selectionStart = startPos;
        textarea.selectionEnd = endPos + prefix.length + suffix.length;
      }, 0);
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
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onSelect={handleSelect}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Ctrl+B for bold, Ctrl+I for italic)"
          rows={1} // start small, it will grow
          onFocus={(e) => {
            if (selectedText || translatedText) {
              setSelectedText('');
              setTranslatedText('');
              e.target.setSelectionRange(0, 0); // clear the selection
            }
          }}
        />
        <div className="selection-toolbar">
          <span>
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
      </div>
    </div>
  );
};

export default MessageInputWithToolbar;