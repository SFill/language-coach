import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook for managing undo/redo functionality with continuous history tracking
 * 
 * @param {Object} textareaRef - React ref for the textarea element
 * @param {string} initialText - Initial text content
 * @param {Function} setText - Function to update text content
 * @param {Function} updateCaretAndScroll - Function to update caret position and scroll
 * @returns {Object} Undo/redo related functions and state
 */
const useUndoRedo = (textareaRef, initialText, setText, updateCaretAndScroll) => {
  // History stack: array of {text, caretPosition} objects
  const [history, setHistory] = useState([
    { text: initialText, caretPosition: 0, selectionEnd: 0 }
  ]);
  // Current position in history stack
  const [historyIndex, setHistoryIndex] = useState(0);
  
  // Track the last pushed text to avoid duplicate entries
  const lastPushedTextRef = useRef(initialText);
  
  // Regular timer for creating history entries during typing
  const historyTimerRef = useRef(null);
  
  // Flag to ignore history pushes during programmatic changes
  const ignoreNextPushRef = useRef(false);

  // Character count since last history entry
  const charsSinceLastHistoryRef = useRef(0);
  
  // Flag to track if we're currently in a formatting operation
  const isFormattingOpRef = useRef(false);
  
  /**
   * Pushes a new state to the history stack immediately
   * 
   * @param {string} newText - New text content
   * @param {number} caretPosition - Current caret position (selectionStart)
   * @param {number} selectionEnd - Current selection end position
   * @param {boolean} isFormatting - Whether this change is from a formatting operation
   */
  const pushHistory = (newText, caretPosition, selectionEnd = caretPosition, isFormatting = false) => {
    // Skip if we should ignore this push
    if (ignoreNextPushRef.current) {
      ignoreNextPushRef.current = false;
      return;
    }
    
    // Skip if text hasn't changed
    if (newText === lastPushedTextRef.current && !isFormatting) {
      return;
    }
    
    // Reset character counter
    charsSinceLastHistoryRef.current = 0;
    
    // Update last pushed text
    lastPushedTextRef.current = newText;
    
    // Slice off any future history if we've done undo operations
    const newHistory = history.slice(0, historyIndex + 1);
    
    // Push the new state
    newHistory.push({ 
      text: newText, 
      caretPosition, 
      selectionEnd 
    });
    
    // Update history and move index forward
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }

  /**
   * Handles text changes with smart history tracking
   * 
   * @param {string} newText - New text content
   * @param {number} caretPosition - Current caret position
   * @param {number} selectionEnd - Current selection end position  
   */
  const handleTextChange = useCallback((newText, caretPosition, selectionEnd = caretPosition) => {
    // If this is a formatting operation, handle it specially
    if (isFormattingOpRef.current) {
        
      pushHistory(newText, caretPosition, selectionEnd, true);
      isFormattingOpRef.current = false;
      return;
    }
    
    // Calculate number of characters changed
    const lengthDiff = Math.abs(newText.length - lastPushedTextRef.current.length);
    charsSinceLastHistoryRef.current += lengthDiff;
    
    // If significant change (10+ chars) or it's been a while since last push
    const significantChange = charsSinceLastHistoryRef.current >= 10;
    
    if (significantChange) {
      // Push immediately for significant changes
      pushHistory(newText, caretPosition, selectionEnd);
    } else {
      // Otherwise, schedule a push if timer not already running
      if (!historyTimerRef.current) {
        historyTimerRef.current = setTimeout(() => {
          // Only push if text is different from last pushed
          if (textareaRef.current && textareaRef.current.value !== lastPushedTextRef.current) {
            pushHistory(
              textareaRef.current.value, 
              textareaRef.current.selectionStart, 
              textareaRef.current.selectionEnd
            );
          }
          historyTimerRef.current = null;
        }, 800); // Create history entries every 800ms during typing
      }
    }
  }, [pushHistory, textareaRef]);

  /**
   * Mark that a formatting operation is about to happen
   * This ensures the state before formatting is saved
   */
  const beforeFormatting = () => {
    // Get current textarea state
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Clear any pending history timer
    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }
    
    const currentText = textarea.value;
    const currentCaretPos = textarea.selectionStart;
    const currentSelEnd = textarea.selectionEnd;
    
    ignoreNextPushRef.current = false;
    // Push current state to history immediately
    pushHistory(currentText, currentCaretPos, currentSelEnd, true);
    
    // Mark that next text change is from formatting
    isFormattingOpRef.current = true;
  }

  /**
   * Performs an undo operation
   */
  const undo = useCallback(() => {
    // Clear any pending history timer
    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
      
      // Push current state before undoing if it's different
      const textarea = textareaRef.current;
      if (textarea && textarea.value !== lastPushedTextRef.current) {
        pushHistory(textarea.value, textarea.selectionStart, textarea.selectionEnd);
      }
    }
    if (historyIndex > 0) {
      // Mark to ignore next push from setText
    //   ignoreNextPushRef.current = true;
      
      // Move back in history
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      
      // Get the previous state
      const prevState = history[newIndex];
      
      // Update text
      setText(prevState.text);
      lastPushedTextRef.current = prevState.text;
      
      // In the next render cycle, restore caret position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = prevState.caretPosition;
          textareaRef.current.selectionEnd = prevState.selectionEnd || prevState.caretPosition;
          updateCaretAndScroll(true);
        }
      }, 0);
    }
  }, [history, historyIndex, setText, textareaRef, updateCaretAndScroll, pushHistory]);

  /**
   * Performs a redo operation
   */
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      // Mark to ignore next push from setText
      ignoreNextPushRef.current = true;
      
      // Move forward in history
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      
      // Get the next state
      const nextState = history[newIndex];
      
      // Update text
      setText(nextState.text);
      lastPushedTextRef.current = nextState.text;
      
      // In the next render cycle, restore caret position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = nextState.caretPosition;
          textareaRef.current.selectionEnd = nextState.selectionEnd || nextState.caretPosition;
          updateCaretAndScroll(true);
        }
      }, 0);
    }
  }, [history, historyIndex, setText, textareaRef, updateCaretAndScroll]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (historyTimerRef.current) {
        clearTimeout(historyTimerRef.current);
      }
    };
  }, []);

  return {
    undo,
    redo,
    pushHistory,
    handleTextChange,
    beforeFormatting,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1
  };
};

export default useUndoRedo;