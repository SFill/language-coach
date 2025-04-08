import React, { useRef, useCallback, useEffect, useState } from 'react';
import './MessageInput.css';

// Import custom hooks
import useLocalStorage from './hooks/useLocalStorage';
import useCaretTracking from './hooks/useCaretTracking';
import useScrollBehavior from './hooks/useScrollBehavior';
import useTextSelection from './hooks/useTextSelection';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';

// Import components
import TextEditor from './TextEditor';
import SelectionToolbar from './SelectionToolbar';

const LOCAL_STORAGE_KEY = 'language-coach-message-input';
const PREFERRED_LANGUAGE_KEY = 'language-coach-preferred-language';

/**
 * MessageInput Component
 * 
 * A text input component with VS Code-like scrolling behavior and a selection toolbar.
 * Refactored to use custom hooks and smaller components.
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onSend - Callback function when user sends a message
 */
const MessageInput = ({ onSend }) => {
  // Create ref for the textarea
  const textareaRef = useRef(null);

  // Use local storage for text persistence and language preference
  const [input, setInput] = useLocalStorage(LOCAL_STORAGE_KEY, '');
  const [savedLanguage, setSavedLanguage] = useLocalStorage(PREFERRED_LANGUAGE_KEY, 'en');

  // Set up caret tracking
  const {
    updateCaretInfo,
    calculateTotalVisualLines
  } = useCaretTracking(textareaRef, input);

  // Set up scroll behavior
  const {
    updateCaretAndScroll,
    handleWheel: scrollHandleWheel,
    handleScroll: scrollHandleScroll
  } = useScrollBehavior(
    textareaRef,
    calculateTotalVisualLines,
    updateCaretInfo,
    input
  );

  // Handle text selections and translations with persisted language preference
  const {
    selectedText,
    handleSelect,
    handleTranslate,
    clearSelection,
    displayText,
    preferredLanguage,
    isTranslating
  } = useTextSelection(
    input, 
    updateCaretInfo, 
    savedLanguage, 
    (newLanguage) => setSavedLanguage(newLanguage)
  );

  // Handle sending messages
  const handleSendMessage = useCallback((isNote = false) => {
    if (isNote) {
      // For notes, send the entire input
      if (input.trim()) {
        onSend(input, isNote);
        setInput('');
      }
    } else {
      // For questions, send the selected text
      if (selectedText.trim()) {
        onSend(selectedText, isNote);
        clearSelection();
      }
    }
  }, [input, selectedText, onSend, setInput, clearSelection]);

  // Set up keyboard shortcuts (only pass updateCaretAndScroll, not both functions)
  const {
    handleKeyDown,
    handleKeyUp
  } = useKeyboardShortcuts(
    textareaRef,
    input,
    setInput,
    updateCaretInfo,
    updateCaretAndScroll, // Only pass the integrated function
    clearSelection,
    handleSendMessage
  );

  // Handle mouse events
  const handleMouseUp = useCallback(() => {
    // When clicking to position the cursor, we need to update both
    // caret position and potentially scroll to keep it visible
    updateCaretAndScroll();
  }, [updateCaretAndScroll]);

  // Handle text changes
  const handleChange = useCallback((e) => {
    setInput(e.target.value);

    // When text changes, we need to update caret position and scrolling
    // Use requestAnimationFrame to ensure DOM is updated first
    requestAnimationFrame(() => {
      updateCaretAndScroll(true);
    });
  }, [setInput, updateCaretAndScroll]);

  // Improved wheel handler with debouncing
  const handleWheel = useCallback((e) => {
    // Use the scroll behavior's wheel handler
    scrollHandleWheel(e);

    // Clear any existing wheel timer
    if (textareaRef.current._wheelTimer) {
      clearTimeout(textareaRef.current._wheelTimer);
    }

    // Set a timer to update position after wheel scrolling stops
    textareaRef.current._wheelTimer = setTimeout(() => {
      if (textareaRef.current && textareaRef.current._isScrollingByWheel) {
        textareaRef.current._isScrollingByWheel = false;
        updateCaretInfo(true);
      }
    }, 150); // Debounce wheel events
  }, [scrollHandleWheel, updateCaretInfo]);

  // Improved scroll handler
  const handleScroll = useCallback((e) => {
    // Use the scroll behavior's scroll handler
    scrollHandleScroll(e);
  }, [scrollHandleScroll]);

  // Handle focus and blur

  return (
    <div className="message-input">
      <div className="text-area-with-toolbar">
        <div className="selection-toolbar-div">
          <SelectionToolbar
            displayText={displayText}
            onTranslate={handleTranslate}
            onSend={handleSendMessage}
            preferredLanguage={preferredLanguage}
            isTranslating={isTranslating}
          />
        </div>
        <TextEditor
          value={input}
          onChange={handleChange}
          onSelect={handleSelect}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onScroll={handleScroll}
          textareaRef={textareaRef}
        />
      </div>
    </div>
  );
};

export default MessageInput;