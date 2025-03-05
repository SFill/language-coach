import React, { useState, useEffect, useRef } from 'react';
import { translateText } from './api.js';
import './ChatWindow.css';

const ChatWindow = ({ messages }) => {
  const containerRef = useRef(null);
  const chatContainerRef = useRef(null);

  const [menuStyle, setMenuStyle] = useState({ display: 'none' });
  const [currentRange, setCurrentRange] = useState(null);
  const [selectedText, setSelectedText] = useState('');
  const [translatedNode, setTranslatedNode] = useState(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);


  const handleSelection = () => {
    const selection = window.getSelection();
  
    if (selection && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      setCurrentRange(range);
      setSelectedText(range.toString());
  
      // Position the toolbar
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      const top =
        rect.top - containerRect.top + chatContainerRef.current.scrollTop - 40;
      const left =
        rect.left - containerRect.left + chatContainerRef.current.scrollLeft;
      setMenuStyle({
        display: 'block',
        position: 'absolute',
        top,
        left,
      });
  
      // Check if selection is entirely inside one translated node
      const anchorTranslated = findTranslatedParent(selection.anchorNode);
      const focusTranslated = findTranslatedParent(selection.focusNode);
  
      // Only set translatedNode if both anchor/focus are inside the same <span data-translated="true">
      if (anchorTranslated && anchorTranslated === focusTranslated) {
        setTranslatedNode(anchorTranslated);
      } else {
        setTranslatedNode(null);
      }
    } else {
      // No valid selection => hide toolbar
      setMenuStyle({ display: 'none' });
      setCurrentRange(null);
      setSelectedText('');
      setTranslatedNode(null);
    }
  };
  
  /**
   * Recursively find a parent element with data-translated="true".
   */
  const findTranslatedParent = (node) => {
    let current = node;
    while (current) {
      if (
        current.nodeType === 1 && // ELEMENT_NODE
        current.getAttribute &&
        current.getAttribute('data-translated') === 'true'
      ) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  };
  

  /**
   * Translate the selected text (or re-translate an existing translated node)
   * and replace the DOM accordingly.
   */
  const handleTranslate = async (lang) => {
    if (!currentRange) return;

    // If user is re-translating a previously translated node:
    if (translatedNode) {
      // Always use the *original* text from data-original-text
      const original = translatedNode.getAttribute('data-original-text');
      const newTranslation = await translateText(original, lang);

      // Update the text content to the new translation
      translatedNode.textContent = newTranslation;
      // Optionally store the current language
      translatedNode.setAttribute('data-current-lang', lang);

      // Keep the underline style
      // (already set from the initial translation, so no change needed)
    } else {
      // Normal flow: we are translating fresh (non-translated) text
      const textToTranslate = selectedText.trim();
      if (!textToTranslate) return;

      const newTranslation = await translateText(textToTranslate, lang);

      // Remove the original selected text
      currentRange.deleteContents();

      // Create a <span> to hold the translated text
      const span = document.createElement('span');
      span.textContent = newTranslation;
      // Mark it as translated and store the original text
      span.setAttribute('data-translated', 'true');
      span.setAttribute('data-original-text', textToTranslate);
      span.setAttribute('data-current-lang', lang);

      // Add a visual marker (blue underline)
      span.style.textDecoration = 'underline';
      span.style.textDecorationColor = 'blue';

      // Insert the new <span> into the DOM
      currentRange.insertNode(span);
    }

    // Clear the user’s selection & hide toolbar
    window.getSelection().removeAllRanges();
    setMenuStyle({ display: 'none' });
    setCurrentRange(null);
    setSelectedText('');
    setTranslatedNode(null);
  };

  /**
   * Rollback to the original text if we're dealing with a translated node.
   */
  const handleRollback = () => {
    if (!translatedNode) return;

    const originalText = translatedNode.getAttribute('data-original-text');
    if (!originalText) return;

    // Option A: Simply revert textContent and remove the special attributes
    // (This leaves a <span> in the DOM, but effectively it's back to original text)
    translatedNode.textContent = originalText;
    translatedNode.removeAttribute('data-translated');
    translatedNode.removeAttribute('data-original-text');
    translatedNode.removeAttribute('data-current-lang');
    translatedNode.removeAttribute('style'); // remove underline

    // Or Option B: replace the <span> entirely with a text node
    // const parent = translatedNode.parentNode;
    // const textNode = document.createTextNode(originalText);
    // parent.replaceChild(textNode, translatedNode);

    // Clear selection & hide toolbar
    window.getSelection().removeAllRanges();
    setMenuStyle({ display: 'none' });
    setCurrentRange(null);
    setSelectedText('');
    setTranslatedNode(null);
  };

  return (
    <div
      className="chat-window-container"
      style={{ position: 'relative' }}
      ref={containerRef}
    >
      <div
        className="chat-window"
        ref={chatContainerRef}
        onMouseUp={handleSelection}
        onTouchEnd={handleSelection}
      >
        {messages.map((msg, index) => (
          <div key={index} className={`chat-message ${msg.sender}`}>
            {msg.text}
          </div>
        ))}
      </div>

      {/* Toolbar shown above selected text */}
      <div style={menuStyle} className="text-edit-menu">
        <button onClick={() => handleTranslate('ru')}>ru</button>
        <button onClick={() => handleTranslate('en')}>en</button>
        <button onClick={() => handleTranslate('es')}>es</button>
        {/* Show rollback button only if we have a translated node selected */}
        {translatedNode && (
          <button onClick={handleRollback} style={{ color: 'red' }}>
            Rollback
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatWindow;
