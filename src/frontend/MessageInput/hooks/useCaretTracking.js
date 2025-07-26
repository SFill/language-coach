import { useState, useCallback } from 'react';

/**
 * Hook for tracking caret position in a textarea
 * 
 * @param {Object} textareaRef - React ref for the textarea element
 * @param {string} text - Current text content
 * @returns {Object} Caret position information and update functions
 */
const useCaretTracking = (textareaRef, text) => {
  // Current caret position info: logical line, visual line, column
  const [caretInfo, setCaretInfo] = useState({ logicalLine: 1, visualLine: 1, column: 1 });
  
  /**
   * Calculate the visual line number (accounting for wrapped lines)
   */
  const calculateVisualLine = useCallback((textarea, cursorPosition, text) => {
    // Get the textarea width (account for padding)
    const textareaWidth = textarea.clientWidth - 16; // Subtract padding (8px on each side)

    // Create a hidden div to measure text width
    const measureDiv = document.createElement('div');
    measureDiv.style.position = 'absolute';
    measureDiv.style.visibility = 'hidden';
    measureDiv.style.whiteSpace = 'pre';
    measureDiv.style.font = window.getComputedStyle(textarea).font;
    document.body.appendChild(measureDiv);

    // Split text by newlines
    const lines = text.substring(0, cursorPosition).split('\n');
    let visualLineCount = 0;

    // For each logical line, calculate how many visual lines it takes
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Measure the exact width
      measureDiv.textContent = line;
      const lineWidth = measureDiv.getBoundingClientRect().width;

      // Calculate how many visual lines this takes
      const wrappedLines = Math.max(1, Math.ceil(lineWidth / textareaWidth));
      visualLineCount += wrappedLines;
    }

    // Clean up the measurement div
    document.body.removeChild(measureDiv);

    return visualLineCount;
  }, []);

  /**
   * Calculate the total number of visual lines in the textarea
   */
  const calculateTotalVisualLines = useCallback((textarea, text) => {
    return calculateVisualLine(textarea, text.length, text);
  }, [calculateVisualLine]);

  /**
   * Updates caret position information
   * @param {boolean} forceUpdate - Whether to force update state even if the position hasn't changed
   * @returns {Object} The updated caret position information
   */
  const updateCaretInfo = useCallback((forceUpdate = false) => {
    console.log(`🔍 [useCaretTracking] updateCaretInfo called with forceUpdate=${forceUpdate}`);
    
    if (!textareaRef.current) {
      console.log(`❌ [useCaretTracking] No textarea ref, returning null`);
      return null;
    }

    // Get cursor position and calculate logical line/column
    const cursorPosition = textareaRef.current.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const logicalLines = textBeforeCursor.split('\n');

    console.log(`📍 [useCaretTracking] Cursor at position ${cursorPosition}, text length: ${text.length}`);

    // Logical line and column (1-based)
    const logicalLine = logicalLines.length;
    const column = logicalLines[logicalLines.length - 1].length + 1;

    // Calculate visual line (accounting for wrapping)
    const visualLine = calculateVisualLine(textareaRef.current, cursorPosition, text);

    console.log(`📊 [useCaretTracking] Calculated - Logical: ${logicalLine}, Visual: ${visualLine}, Column: ${column}`);

    // Create the new caret info object
    const newCaretInfo = {
      logicalLine,
      visualLine,
      column,
      cursorPosition // Track actual cursor position too
    };

    // Only update state if the position has changed or forceUpdate is true
    const shouldUpdate = forceUpdate || 
        caretInfo.logicalLine !== logicalLine || 
        caretInfo.column !== column ||
        caretInfo.cursorPosition !== cursorPosition;

    console.log(`🔄 [useCaretTracking] Should update state: ${shouldUpdate} (forceUpdate: ${forceUpdate}, position changed: ${caretInfo.cursorPosition !== cursorPosition})`);

    if (shouldUpdate) {
      setCaretInfo(newCaretInfo);
      console.log(`✅ [useCaretTracking] State updated to:`, newCaretInfo);
    }

    return newCaretInfo;
  }, [textareaRef, text, calculateVisualLine, caretInfo]);

  /**
   * Updates caret position without changing scroll position
   * Used specifically for user-initiated scrolling (wheel, scrollbar)
   */
  const updateCaretInfoWithoutScrolling = useCallback(() => {
    if (!textareaRef.current) return;

    const cursorPosition = textareaRef.current.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lines = textBeforeCursor.split('\n');

    const logicalLine = lines.length;
    const column = lines[lines.length - 1].length + 1;
    const visualLine = calculateVisualLine(textareaRef.current, cursorPosition, text);

    setCaretInfo({ logicalLine, visualLine, column });
  }, [textareaRef, text, calculateVisualLine]);

  return {
    caretInfo,
    updateCaretInfo,
    updateCaretInfoWithoutScrolling,
    calculateVisualLine,
    calculateTotalVisualLines
  };
};

export default useCaretTracking;