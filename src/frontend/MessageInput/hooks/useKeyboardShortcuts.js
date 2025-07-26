import { useCallback } from 'react';

/**
 * Hook to handle keyboard shortcuts and special key events
 * 
 * @param {Object} textareaRef - Reference to the textarea element
 * @param {string} text - Current text content
 * @param {Function} setText - Function to update text content
 * @param {Function} updateCaretInfo - Function to update caret position
 * @param {Function} updateCaretAndScroll - Function to update caret and scroll position
 * @param {Function} clearSelection - Function to clear selection state
 * @param {Function} handleSend - Function to send message/note
 * @param {Object} undoRedo - Undo/redo related functions
 * @param {Function} translateSelection - Function to translate current selection
 * @returns {Object} Keyboard event handlers
 */
const useKeyboardShortcuts = (
  textareaRef,
  text,
  setText,
  updateCaretInfo,
  updateCaretAndScroll,
  clearSelection,
  handleSend,
  undoRedo,
  translateSelection
) => {
  const { undo, redo, beforeFormatting, handleTextChange } = undoRedo;

  /**
   * Applies markdown formatting to selected text or at cursor position
   */

  const applyMarkdownFormatting = useCallback((prefix, suffix) => {
    function _changed(text, textarea) {
      handleTextChange(
        text, 
        textarea.selectionStart, 
        textarea.selectionEnd
      );
    }

    const textarea = textareaRef.current;
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;

    // Save current state to history before making changes
    beforeFormatting();

    if (startPos === endPos) {
      // No selection, just insert the markers and place cursor between them
      const newText = text.substring(0, startPos) + prefix + suffix + text.substring(endPos);
      setText(newText);

      // Place cursor between the markers
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = startPos + prefix.length;
        // Update both caret info and scroll position
        updateCaretAndScroll(true);
        _changed(newText, textarea)
      }, 0);
      
    } else {
      // Text is selected, wrap it with the markers
      const selectedText = text.substring(startPos, endPos);
      const newText = text.substring(0, startPos) + prefix + selectedText + suffix + text.substring(endPos);
      setText(newText);

      // Select the text including the markers
      setTimeout(() => {
        textarea.selectionStart = startPos;
        textarea.selectionEnd = endPos + prefix.length + suffix.length;
        // Update both caret info and scroll position
        updateCaretAndScroll(true);
        _changed(newText, textarea)
      }, 0);
    }

   
  }, [textareaRef, text, setText, updateCaretAndScroll, beforeFormatting]);

  const handleTabKey = (e) => {
    function _changed(text, textarea) {
      handleTextChange(
        text, 
        textarea.selectionStart, 
        textarea.selectionEnd
      );
    }
    const textarea = textareaRef.current;
    e.preventDefault();
    
    // Save current state before tab formatting
    beforeFormatting();
    
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    
    // Check if there's a selection
    if (startPos === endPos) {
      // No selection - just insert 4 spaces at cursor position
      const newText = text.substring(0, startPos) + '    ' + text.substring(endPos);
      setText(newText);
      
      // Set cursor position after the inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = startPos + 4;
        updateCaretAndScroll(true);
      }, 0);
    } else {
      // There's a selection - need to handle multi-line indentation
      
      
      // Find the start of the first line of the selection
      let lineStart = startPos;
      while (lineStart > 0 && text[lineStart - 1] !== '\n') {
        lineStart--;
      }
      
      // Split the text into parts: before selection, selection, after selection
      const beforeSelection = text.substring(0, lineStart);
      const afterSelection = text.substring(endPos);
      
      // Process the selected text with the potential part of the first line
      const textToProcess = text.substring(lineStart, endPos);
      
      // Add indentation to each line
      const indentedText = textToProcess.replace(/^|(\n)/g, '$1    ');
      
      // Combine everything back
      const newText = beforeSelection + indentedText + afterSelection;
      setText(newText);
      
      // Calculate new positions for selection
      const newStartPos = lineStart + 4; // First line gets 4 spaces
      const newEndPos = lineStart + indentedText.length;
      
      // Set new selection
      setTimeout(() => {
        textarea.selectionStart = newStartPos;
        textarea.selectionEnd = newEndPos;
        updateCaretAndScroll(true);
        _changed(newText,textarea)
      }, 0);
    }
  };
  

  /**
   * Enhanced keyboard event handler with VS Code-like navigation behavior
   */
  const handleKeyDown = useCallback((e) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Mark keyboard navigation for scrolling behavior
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(e.key)) {
      textarea._isScrollingByKeyboard = true;

      // For arrow keys, we need special handling to ensure VS Code-like scrolling
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        // because it's annoying
        if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !e.shiftKey) {
          clearSelection();
        }

        const currentPosition = textarea.selectionStart;

        // Let the default browser behavior happen first
        requestAnimationFrame(() => {
          const newPosition = textarea.selectionStart;

          // Only apply our custom scrolling if the position actually changed
          if (newPosition !== currentPosition) {
            // Force an update of the caret position and scrolling
            updateCaretAndScroll(true);
          }

          // Reset the keyboard scrolling flag
          setTimeout(() => {
            textarea._isScrollingByKeyboard = false;
          }, 10);
        });
      } else {
        // For other navigation keys
        requestAnimationFrame(() => {
          updateCaretAndScroll(true);

          // Reset the keyboard scrolling flag
          setTimeout(() => {
            textarea._isScrollingByKeyboard = false;
          }, 10);
        });
      }
    }
    // TODO doensot work well, fix later
    // Undo - Ctrl+Z
    // if (e.key === 'z' && e.ctrlKey && !e.shiftKey) {
    //   e.preventDefault();
    //   undo();
    // }

    // Redo - Ctrl+Y or Ctrl+Shift+Z
    else if ((e.key === 'y' && e.ctrlKey) || (e.key === 'z' && e.ctrlKey && e.shiftKey)) {
      e.preventDefault();
      redo();
    }

    // Tab key - insert 4 spaces instead of changing focus
    else if (e.key === 'Tab') {
      handleTabKey(e)
    }

    // Backspace key in translation area - clear selection
    else if (e.key === 'Backspace' && clearSelection) {
      clearSelection();
    }
    // Ctrl + E: clear selection
    else if (e.key === 'e' && e.ctrlKey) {
      e.preventDefault();
      clearSelection();
    }

    // Ctrl + Enter to send as note
    else if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSend(true); // true = send as note
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
    // Translate selection: Ctrl+Shift+T
    else if (e.key === 'T' && e.ctrlKey && e.shiftKey && translateSelection) {
      e.preventDefault();
      translateSelection();
    }
  }, [
    textareaRef,
    text,
    setText,
    updateCaretInfo,
    clearSelection,
    handleSend,
    applyMarkdownFormatting,
    undo,
    redo,
    beforeFormatting,
    translateSelection
  ]);

  /**
   * Handler for keyup events (only for non-arrow keys that need additional handling)
   */
  const handleKeyUp = useCallback((e) => {
    const nonArrowNavKeys = ["Home", "End", "PageUp", "PageDown"];
    if (nonArrowNavKeys.includes(e.key)) {
      updateCaretInfo();
    }
  }, [updateCaretInfo]);

  return {
    handleKeyDown,
    handleKeyUp,
    applyMarkdownFormatting
  };
};

export default useKeyboardShortcuts;