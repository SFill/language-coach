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
 * @returns {Object} Keyboard event handlers
 */
const useKeyboardShortcuts = (
  textareaRef,
  text,
  setText,
  updateCaretInfo,
  updateCaretAndScroll,
  clearSelection,
  handleSend
) => {
  /**
   * Applies markdown formatting to selected text or at cursor position
   */
  const applyMarkdownFormatting = useCallback((prefix, suffix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;

    if (startPos === endPos) {
      // No selection, just insert the markers and place cursor between them
      const newText = text.substring(0, startPos) + prefix + suffix + text.substring(endPos);
      setText(newText);

      // Place cursor between the markers
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = startPos + prefix.length;
        // Update both caret info and scroll position
        updateCaretAndScroll(true);
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
      }, 0);
    }
  }, [textareaRef, text, setText, updateCaretAndScroll]);

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
        if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !e.shiftKey ){
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

    // Tab key - insert 4 spaces instead of changing focus
    if (e.key === 'Tab') {
      e.preventDefault();

      const startPos = textarea.selectionStart;
      const endPos = textarea.selectionEnd;

      // Insert 4 spaces at the cursor position
      const newText = text.substring(0, startPos) + '    ' + text.substring(endPos);
      setText(newText);

      // Set cursor position after the inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = startPos + 4;
        // Update both caret info and scroll position
        updateCaretAndScroll(true);
      }, 0);
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
  }, [
    textareaRef, 
    text, 
    setText, 
    updateCaretInfo, 
    clearSelection, 
    handleSend, 
    applyMarkdownFormatting
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