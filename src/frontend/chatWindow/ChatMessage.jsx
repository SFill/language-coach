import React, { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import FoldToggle from './FoldToggle';
import { translateText } from '../api.js';
import './ChatMessage.css';

const FOLD_THRESHOLD = 300; // Characters threshold to consider a message long.
const FOLDED_MAX_HEIGHT = '100px'; // Maximum height for a folded message.

const ChatMessage = forwardRef(({ msg, onTextSelect }, ref) => {
  const isBot = msg.sender === 'bot';
  const isLong = msg.text.length > FOLD_THRESHOLD;
  const [isExpanded, setIsExpanded] = useState(false);

  // --- Translation State & Refs ---
  const messageContainerRef = useRef(null);
  const [currentRange, setCurrentRange] = useState(null);       // Range for fresh text selection.
  const [translatedNode, setTranslatedNode] = useState(null);   // The clicked <span data-translated="true">.
  const [selectedText, setSelectedText] = useState('');         // For new translations or re-translation.

  const toggleExpanded = () => {
    setIsExpanded(prev => !prev);
  };

  /**
   * Given a Range, adjust its boundaries if they fall inside a translated span.
   * This ensures that if a user selection overlaps an already translated snippet,
   * we trim the selection so it doesn't include the translated parts.
   */
  const adjustRange = (range) => {
    const newRange = range.cloneRange();
    const startTranslated = findTranslatedParent(newRange.startContainer);
    if (startTranslated) {
      newRange.setStartAfter(startTranslated);
    }
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
        current.nodeType === 1 &&
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
  const handleSelection = (e) => {
    e.stopPropagation();
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      let range = selection.getRangeAt(0);
      const adjustedRange = adjustRange(range);
      if (adjustedRange.collapsed) return;
      setCurrentRange(adjustedRange);
      setTranslatedNode(null);
      let div = document.createElement('div');
      div.appendChild(adjustedRange.cloneContents());
      const text = div.innerHTML;
      setSelectedText(text);
      const rect = adjustedRange.getBoundingClientRect();
      // Notify parent with isTranslated = false (fresh selection).
      if (onTextSelect) {
        onTextSelect(rect, text, false);
      }
    }
  };

  /**
   * 2) CLICK FLOW  
   * If the user clicks on an already-translated <span>, notify parent to show/reposition the toolbar.
   */
  const handleClick = (e) => {
    e.stopPropagation();
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    const target = e.target.closest('span[data-translated]');
    if (!target || target.nodeType !== 1) return;
    const isTranslated = target.getAttribute('data-translated') === 'true';
    if (isTranslated) {
      e.stopPropagation();
      setTranslatedNode(target);
      const text = target.getAttribute('data-original-text') || target.innerHTML;
      setSelectedText(text);
      const rect = target.getBoundingClientRect();
      // Notify parent with isTranslated = true.
      if (onTextSelect) {
        onTextSelect(rect, text, true);
      }
    }
  };

  /**
   * Translate the selected text or re-translate the clicked snippet.
   * This method is exposed to the parent via ref.
   */
  const handleTranslate = async (lang) => {
    if (translatedNode) {
      const original = translatedNode.getAttribute('data-original-text');
      if (!original) return;
      const newTranslation = await translateText(original, lang);
      translatedNode.innerHTML = newTranslation;
      translatedNode.setAttribute('data-current-lang', lang);
      return;
    }
    if (!currentRange) return;
    const textToTranslate = selectedText;
    if (!textToTranslate.trim()) return;
    const newTranslation = await translateText(textToTranslate, lang);
    currentRange.deleteContents();
    const span = document.createElement('span');
    span.addEventListener('click', handleClick);
    span.innerHTML = newTranslation;
    span.setAttribute('data-translated', 'true');
    span.setAttribute('data-original-text', textToTranslate);
    span.setAttribute('data-current-lang', lang);
    span.style.cursor = 'pointer';
    span.style.textDecoration = 'underline';
    span.style.textDecorationColor = 'blue';
    currentRange.insertNode(span);
  };

  /**
   * Rollback the currently clicked snippet to its original text.
   * This method is exposed to the parent via ref.
   */
  const handleRollback = () => {
    if (!translatedNode) return;
    const originalText = translatedNode.getAttribute('data-original-text');
    if (!originalText) return;
    translatedNode.innerHTML = originalText;
    
    // unwrap content back
    const parent = translatedNode.parentNode;
    // Move all child nodes of span into the parent, before the span
    while (translatedNode.firstChild) {
      parent.insertBefore(translatedNode.firstChild, translatedNode);
    }
    // Remove the now-empty span
    parent.removeChild(translatedNode);
  };

  // Expose API methods to parent via ref.
  useImperativeHandle(ref, () => ({
    handleTranslate,
    handleRollback
  }));

  // Document-level mouseup handler to process selection even when mouseup occurs outside.
  useEffect(() => {
    const globalMouseUpHandler = (e) => {
      const selection = window.getSelection();
      if (
        selection &&
        !selection.isCollapsed &&
        messageContainerRef.current &&
        messageContainerRef.current.contains(selection.anchorNode)
      ) {
        handleSelection(e);
      }
    };
    document.addEventListener('mouseup', globalMouseUpHandler);
    return () => {
      document.removeEventListener('mouseup', globalMouseUpHandler);
    };
  }, [currentRange, selectedText]);

  return (
    <div className={`chat-message ${msg.sender}`}>
      {isBot && isLong && (
        // Fold toggle button for long bot messages.
        <FoldToggle isExpanded={isExpanded} onClick={(e) => { e.stopPropagation(); toggleExpanded(); }} />
      )}
      <div
        ref={messageContainerRef}
        onTouchEnd={handleSelection}
        onClick={handleClick}
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
          <div className="fold-gradient"></div>
        )}
      </div>
    </div>
  );
});

export default ChatMessage;
