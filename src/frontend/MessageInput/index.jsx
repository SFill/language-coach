import React, { useRef, useCallback, useEffect, useState } from 'react';
import './MessageInput.css';

// Import custom hooks
import useLocalStorage from './hooks/useLocalStorage';
import useCaretTracking from './hooks/useCaretTracking';
import useScrollBehavior from './hooks/useScrollBehavior';
import useTextSelection from './hooks/useTextSelection';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import useUndoRedo from './hooks/useUndoRedo';

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

  // Set up undo/redo functionality with improved behavior
  const {
    undo,
    redo,
    handleTextChange,
    beforeFormatting,
    canUndo,
    canRedo
  } = useUndoRedo(textareaRef, input, setInput, updateCaretAndScroll);

  // Handle text selections and translations with persisted language preference
  const {
    selectedText,
    handleSelect,
    handleTranslate,
    clearSelection,
    translateSelection,
    displayText,
    preferredLanguage,
    isTranslating
  } = useTextSelection(
    input, 
    updateCaretInfo, 
    savedLanguage, 
    (newLanguage) => setSavedLanguage(newLanguage),
    setInput,
    textareaRef,
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

  // Set up keyboard shortcuts (pass undo/redo functions)
  const {
    handleKeyDown,
    handleKeyUp
  } = useKeyboardShortcuts(
    textareaRef,
    input,
    setInput,
    updateCaretInfo,
    updateCaretAndScroll,
    clearSelection,
    handleSendMessage,
    { undo, redo, beforeFormatting, handleTextChange }, // Pass undo/redo functions
    translateSelection // Pass translate selection function
  );

  // Handle mouse events
  const handleMouseUp = useCallback(() => {
    // When clicking to position the cursor, we need to update both
    // caret position and potentially scroll to keep it visible
    updateCaretAndScroll();
  }, [updateCaretAndScroll]);

  // Handle text changes with continuous history tracking
  const handleChange = useCallback((e) => {
    const newValue = e.target.value;
    const textarea = textareaRef.current;
    
    console.log(`📝 [handleChange] Text changed from ${input.length} to ${newValue.length} chars`);
    console.log(`📝 [handleChange] Change type: ${newValue.length > input.length ? 'INSERT' : newValue.length < input.length ? 'DELETE' : 'REPLACE'}`);
    
    if (!textarea) {
      console.log(`❌ [handleChange] No textarea ref`);
      return;
    }
    
    // Update the input state
    setInput(newValue);
    console.log(`✅ [handleChange] Input state updated`);
    
    // Track this change in history
    handleTextChange(
      newValue, 
      textarea.selectionStart, 
      textarea.selectionEnd
    );

    // When text changes, we need to update caret position and scrolling
    // Use requestAnimationFrame to ensure DOM is updated first
    requestAnimationFrame(() => {
      console.log(`🎬 [handleChange] Calling updateCaretAndScroll(true) in requestAnimationFrame`);
      updateCaretAndScroll(true);
    });
  }, [setInput, updateCaretAndScroll, handleTextChange, input.length]);

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