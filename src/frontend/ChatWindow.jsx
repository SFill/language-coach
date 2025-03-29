import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { translateText } from './api.js';
import './ChatWindow.css';
import remarkBreaks from 'remark-breaks'

import downArrow from './assets/down-arrow.png'
import rightArrow from './assets/right-arrow.png'
import imgDictionary from './assets/dictionary.png'

const ChatWindow = ({ messages, onCheckInDictionary }) => {
  const containerRef = useRef(null);     // Outer container with position: relative
  const chatContainerRef = useRef(null);   // Scrollable chat window

  const [menuStyle, setMenuStyle] = useState({ display: 'none' });

  // New state to track expanded messages for bot messages
  const [expandedMessages, setExpandedMessages] = useState({});

  // We store info about the current “editing” context
  const [currentRange, setCurrentRange] = useState(null);       // Range for fresh text selection
  const [translatedNode, setTranslatedNode] = useState(null);   // The clicked <span data-translated="true">
  const [selectedText, setSelectedText] = useState('');         // For new translations or re-translation

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const toggleExpanded = (index) => {
    setExpandedMessages(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  /**
   * Given a Range, adjust its boundaries if they fall inside a translated span.
   * This ensures that if a user selection overlaps an already translated snippet,
   * we trim the selection so it doesn't include the translated parts.
   */
  const adjustRange = (range) => {
    const newRange = range.cloneRange();

    // If the start of the range is inside a translated span, move it after that span.
    const startTranslated = findTranslatedParent(newRange.startContainer);
    if (startTranslated) {
      newRange.setStartAfter(startTranslated);
    }

    // If the end of the range is inside a translated span, move it before that span.
    const endTranslated = findTranslatedParent(newRange.endContainer);
    if (endTranslated) {
      newRange.setEndBefore(endTranslated);
    }

    return newRange;
  };

  /**
   * Recursively search up the DOM tree to see if this node is inside a translated span.
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
   * 1) MOUSE/TAP SELECTION FLOW
   * When the user selects text and releases the mouse/touch, we adjust the range
   * to remove any overlap with an existing translated snippet.
   */
  const handleSelection = () => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      let range = selection.getRangeAt(0);
      // Adjust the range to trim any overlap with a translated span.
      const adjustedRange = adjustRange(range);
      // If after adjustment the selection is empty, hide toolbar.
      if (adjustedRange.collapsed) {
        hideToolbar();
        return;
      }
      setCurrentRange(adjustedRange);
      setTranslatedNode(null); // fresh selection, not a click
      // const text = adjustedRange.toString();

      let div = document.createElement('div');
      div.appendChild(adjustedRange.cloneContents());
      const text = div.innerHTML;

      setSelectedText(text);
      showToolbarAtRect(adjustedRange.getBoundingClientRect());
    } else {
      hideToolbar();
    }
  };

  /**
   * 2) CLICK FLOW
   * If the user clicks on an already-translated <span>, toggle the toolbar.
   * Also, if a click happens right after selection (and the selection is still non-empty),
   * we ignore it so that it does not hide the toolbar.
   */
  const handleClick = (e) => {
    const selection = window.getSelection();
    // debugger
    if (selection && !selection.isCollapsed) {
      // Ignore click events if there's an active selection.
      return;
    }

    // const target = e.target;
    const target = e.target.closest('span[data-translated]');

    // If clicked outside an element, hide toolbar.
    if (!target || target.nodeType !== 1) {
      hideToolbar();
      return;
    }
    // debugger

    const isTranslated = target.getAttribute('data-translated') === 'true';

    if (isTranslated) {
      // Toggle: if the same translated span is clicked again, hide toolbar.
      if (translatedNode && translatedNode === target) {
        hideToolbar();
      } else {
        e.stopPropagation(); // Prevent interfering with selection events.
        setTranslatedNode(target);
        setCurrentRange(null); // We're not dealing with a fresh selection here.
        // Use the original text for potential re-translation.
        setSelectedText(target.getAttribute('data-original-text') || '');
        showToolbarAtRect(target.getBoundingClientRect());
      }
    } else {
      hideToolbar();
    }
  };

  /**
   * Helper to position the toolbar at a bounding rectangle (from selection or element).
   */
  const showToolbarAtRect = (rect) => {
    if (!rect || !containerRef.current || !chatContainerRef.current) {
      hideToolbar();
      return;
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    const top =
      rect.top - containerRect.top + chatContainerRef.current.scrollTop - 40; // 40px above
    const left =
      rect.left - containerRect.left + chatContainerRef.current.scrollLeft;

    setMenuStyle({
      display: 'block',
      position: 'absolute',
      top,
      left,
    });
  };

  /**
   * Hides the toolbar and resets the selection state.
   */
  const hideToolbar = () => {
    setMenuStyle({ display: 'none' });
    setCurrentRange(null);
    setTranslatedNode(null);
    setSelectedText('');
  };

  /**
   * Translate the selected text or re-translate the clicked snippet.
   */
  const handleTranslate = async (lang) => {
    // Re-translate a clicked snippet.
    if (translatedNode) {
      const original = translatedNode.getAttribute('data-original-text');
      if (!original) return;
      const newTranslation = await translateText(original, lang);
      translatedNode.innerHTML = newTranslation;
      translatedNode.setAttribute('data-current-lang', lang);
      hideToolbar();
      return;
    }

    // Translate a fresh selection.
    if (!currentRange) return;
    // don't trim selectedText when translate to keep whitespaces at place
    const textToTranslate = selectedText;
    if (!textToTranslate.trim()) return;

    const newTranslation = await translateText(textToTranslate, lang);

    // Delete the original text from the Range.
    currentRange.deleteContents();

    // Create a new <span> to hold the translated text.
    const span = document.createElement('span');
    span.addEventListener('click', handleClick)
    span.innerHTML = newTranslation;
    span.setAttribute('data-translated', 'true');
    span.setAttribute('data-original-text', textToTranslate);
    span.setAttribute('data-current-lang', lang);

    // Make the span clickable with a pointer cursor and style it with an underline.
    span.style.cursor = 'pointer';
    span.style.textDecoration = 'underline';
    span.style.textDecorationColor = 'blue';

    // Insert the new span into the DOM.
    currentRange.insertNode(span);

    // Clear the selection and hide the toolbar.
    window.getSelection().removeAllRanges();
    hideToolbar();
  };

  /**
   * Rollback the currently clicked snippet to its original text.
   */
  const handleRollback = () => {
    if (!translatedNode) return;
    const originalText = translatedNode.getAttribute('data-original-text');
    if (!originalText) return;

    // Option: revert textContent and remove translation-specific attributes.
    translatedNode.innerHTML = originalText;
    translatedNode.removeAttribute('data-translated');
    translatedNode.removeAttribute('data-original-text');
    translatedNode.removeAttribute('data-current-lang');
    translatedNode.removeAttribute('style'); // Removes underline and pointer

    hideToolbar();
  };

  const checkInDictionary = () => {
    onCheckInDictionary(selectedText)
  }

  const showDictionaryButton = () => {
    // const textToTranslate = selectedText;
    // return !(textToTranslate.trim().split(' ').length > 1);
    // probably will need to hide that latter
    return true;
  }

  const FOLD_THRESHOLD = 300; // Characters threshold to consider a message long
  const FOLDED_MAX_HEIGHT = '100px'; // Maximum height for a folded message

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
        {messages.map((msg, index) => {
          const isBot = msg.sender === 'bot';
          const isLong = msg.text.length > FOLD_THRESHOLD;
          const isExpanded = expandedMessages[index];
          return (
            <div key={index} className={`chat-message ${msg.sender}`}>
              {isBot && isLong && (
                <div
                  className="fold-toggle"
                  style={{ cursor: 'pointer', marginTop: '5px' }}
                  onClick={() => toggleExpanded(index)}
                >
                  <img
                    src={
                      isExpanded
                        ? downArrow
                        : rightArrow
                    }
                    alt={isExpanded ? 'Collapse' : 'Expand'}
                    style={{ width: '16px', height: '16px' }}
                  />
                </div>
              )}
              <div
                style={
                  isBot && isLong && !isExpanded
                    ? { position: 'relative', maxHeight: FOLDED_MAX_HEIGHT, overflow: 'hidden' }
                    : {}
                }
              >
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                  {msg.text}
                </ReactMarkdown>

                {/* Шторка-градиент, показывается только если сообщение свернуто */}
                {isBot && isLong && !isExpanded && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '50px',
                      pointerEvents: 'none',
                      background: 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,1))',
                    }}
                  />
                )}

              </div>

            </div>
          );
        })}
      </div>

      {/* Toolbar shown above selected text or clicked snippet */}
      <div style={menuStyle} className="text-edit-menu">
        <button onClick={() => handleTranslate('ru')}>ru</button>
        <button onClick={() => handleTranslate('en')}>en</button>
        <button onClick={() => handleTranslate('es')}>es</button>
        {
          showDictionaryButton() &&

          (<button onClick={() => checkInDictionary()}
            style={{
              backgroundImage: `url(${imgDictionary})`,
              backgroundSize: 'cover', // optional
              width: '25px',            // optional
              height: '25px',           // optional
              border: 'none',           // optional
              cursor: 'pointer',         // optional
            }}
          ></button>)
        }

        {translatedNode && (
          <button onClick={handleRollback} style={{ color: 'red' }}>
            Rollback
          </button>
        )}
      </div>
    </div >
  );
};

export default ChatWindow;
