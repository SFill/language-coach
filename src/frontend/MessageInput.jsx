import React, { useState, useRef, useEffect } from 'react';
import { translateText } from './api.js';
import './MessageInput.css';

const LOCAL_STORAGE_KEY = 'language-coach-message-input';

/**
 * MessageInputWithToolbar Component
 * 
 * A text input component with VS Code-like scrolling behavior and a selection toolbar.
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onSend - Callback function when user sends a message
 */
const MessageInputWithToolbar = ({ onSend }) => {
  // =========== STATE MANAGEMENT ===========
  const [input, setInput] = useState('');                               // Text content
  const [selectedText, setSelectedText] = useState('');                 // Currently selected text
  const [translatedText, setTranslatedText] = useState('');             // Translated text (if any)
  const [caretInfo, setCaretInfo] = useState({ line: 1, column: 1 });   // Current caret position (line/col)
  const textareaRef = useRef(null);                                     // Reference to the textarea DOM element

  // =========== CORE CONSTANTS ===========
  // CRITICAL: This must match the CSS line-height for accurate calculations
  const lineHeight = 20; // Approximate line height in pixels

  // Number of lines that can be displayed in the viewport
  const [visibleLines, setVisibleLines] = useState(0);

  // =========== INITIALIZATION ===========

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
    // Update caret info whenever input changes
    updateCaretInfo();
  }, [input]);

  // Initialize and handle window resize for responsive behavior
  useEffect(() => {
    if (textareaRef.current) {
      // Calculate visible lines based on textarea height
      // HIDDEN LOGIC: This assumes each line is exactly lineHeight pixels tall
      const height = textareaRef.current.clientHeight;
      setVisibleLines(Math.floor(height / lineHeight));

      // Set initial focus
      textareaRef.current.focus();
    }

    // Add window resize handler for responsive behavior
    const handleResize = () => {
      if (textareaRef.current) {
        const height = textareaRef.current.clientHeight;
        setVisibleLines(Math.floor(height / lineHeight));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // =========== CORE SCROLLING ALGORITHM ===========


  /**
   * Updates caret position information without changing scroll position
   * Used specifically for user-initiated scrolling (wheel, scrollbar)
   */
  const updateCaretInfoWithoutScrolling = () => {
    if (!textareaRef.current) return;

    const cursorPosition = textareaRef.current.selectionStart;
    const textBeforeCursor = input.substring(0, cursorPosition);
    const lines = textBeforeCursor.split('\n');

    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;

    setCaretInfo({ line, column });
    // Don't call ensureCaretVisible here to avoid interfering with wheel scrolling
  };

  /**
   * Calculate the visual line number (accounting for wrapped lines)
   * 
   * @param {HTMLTextAreaElement} textarea - The textarea element
   * @param {number} cursorPosition - Current cursor position
   * @param {string} text - The full text content
   * @returns {number} - The visual line number (1-based)
   */
  const calculateVisualLine = (textarea, cursorPosition, text) => {
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

      if (i === lines.length - 1) {
        // For the current line, measure the exact width
        measureDiv.textContent = line;
        const lineWidth = measureDiv.getBoundingClientRect().width;

        // Calculate how many visual lines this takes
        const wrappedLines = Math.max(1, Math.ceil(lineWidth / textareaWidth));
        visualLineCount += wrappedLines;
      } else {
        // For previous lines, do the same measurement
        measureDiv.textContent = line;
        const lineWidth = measureDiv.getBoundingClientRect().width;

        // Calculate how many visual lines this takes
        const wrappedLines = Math.max(1, Math.ceil(lineWidth / textareaWidth));
        visualLineCount += wrappedLines;
      }
    }

    // Clean up the measurement div
    document.body.removeChild(measureDiv);

    return visualLineCount;
  };

  /**
   * Calculate the total number of visual lines in the textarea
   * 
   * @param {HTMLTextAreaElement} textarea - The textarea element
   * @param {string} text - The full text content
   * @returns {number} - The total number of visual lines
   */
  const calculateTotalVisualLines = (textarea, text) => {
    return calculateVisualLine(textarea, text.length, text);
  };

  /**
   * Updates the caret position information and ensures it's visible
   * This is the main function that implements VS Code-like scrolling behavior with wrapped line support
   */
  const updateCaretInfo = () => {
    if (!textareaRef.current) return;

    // Get cursor position and calculate logical line/column
    const cursorPosition = textareaRef.current.selectionStart;
    const textBeforeCursor = input.substring(0, cursorPosition);
    const logicalLines = textBeforeCursor.split('\n');

    // Logical line and column (1-based)
    const logicalLine = logicalLines.length;
    const column = logicalLines[logicalLines.length - 1].length + 1;

    // Calculate visual line (accounting for wrapping)
    const visualLine = calculateVisualLine(textareaRef.current, cursorPosition, input);

    // Update caret info with both logical and visual line
    setCaretInfo({
      logicalLine,
      visualLine,
      column
    });

    // Apply VS Code-like scrolling behavior using visual lines
    ensureCaretVisible(visualLine);
  };

  /**
   * Ensures caret remains visible with VS Code's margin behavior
   * 
   * @param {number} visualLine - The visual line number where the caret is located (1-based)
   */
  const ensureCaretVisible = (visualLine) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;

    // Calculate total visual lines
    const totalVisualLines = calculateTotalVisualLines(textarea, input);

    // Get current scroll position in pixels and convert to visual lines
    const scrollTop = textarea.scrollTop;
    const currentScrollLine = Math.floor(scrollTop / lineHeight);

    // VS Code keeps a margin of ~30% of visible area when possible
    const margin = Math.floor(visibleLines * 0.3);

    // Store the current scroll position to detect if we need to scroll
    const initialScrollTop = textarea.scrollTop;

    // Calculate the target scroll position
    let targetScrollTop = initialScrollTop;

    // Check if cursor is too close to top
    if (visualLine - currentScrollLine < margin) {
      // Scroll up to maintain margin (but not beyond top)
      const newScrollLine = Math.max(0, visualLine - margin);
      targetScrollTop = newScrollLine * lineHeight;
    }

    // Check if cursor is too close to bottom
    else if (currentScrollLine + visibleLines - visualLine < margin) {
      // Scroll down to maintain margin (but not beyond bottom)
      const newScrollLine = Math.min(
        totalVisualLines - visibleLines,
        visualLine - visibleLines + margin
      );
      targetScrollTop = newScrollLine * lineHeight;
    }

    // Only scroll if the position would actually change significantly
    if (Math.abs(targetScrollTop - initialScrollTop) > 2) {
      textarea.scrollTop = targetScrollTop;
    }
  };
  // =========== EVENT HANDLERS ===========

  /**
   * Handles text selection in the textarea
   * Updates the selectedText state and clears any existing translation
   */
  const handleSelect = (e) => {
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const sel = input.substring(start, end);
    if (sel.length > 0) {
      setSelectedText(sel);
      setTranslatedText('');
    }
    updateCaretInfo();
  };

  /**
   * Handles wheel scrolling events
   * Allows native browser scrolling but updates caret position display
   */
  const handleWheel = (e) => {
    // Mark that we're scrolling via wheel
    // HIDDEN LOGIC: Uses a non-standard property on the DOM element to track scroll source
    if (textareaRef.current) {
      textareaRef.current._isScrollingByWheel = true;
    }

    // Let the default wheel behavior happen first
    // Then update caret info to ensure position indicator stays accurate
    // HIDDEN LOGIC: Uses requestAnimationFrame for proper timing with browser render cycle
    requestAnimationFrame(() => {
      // After scrolling has completed, update caret info
      // but don't modify the scroll position
      updateCaretInfoWithoutScrolling();
    });
  };

  /**
   * Handles general scroll events (scrollbar, programmatic scrolling)
   * Differentiates between different scrolling sources
   */
  const handleScroll = (e) => {
    // Only handle scrolls that aren't from wheel or keyboard events
    // This mostly handles scrollbar dragging and programmatic scrolling
    // HIDDEN LOGIC: Uses custom flags to track scroll source
    if (e.target._isScrollingByWheel || e.target._isScrollingByKeyboard) {
      // Reset the flag after handling
      e.target._isScrollingByWheel = false;
      e.target._isScrollingByKeyboard = false;
      return;
    }

    // For manual scrollbar interactions, just update the caret position indicator
    // without modifying the scroll position
    updateCaretInfoWithoutScrolling();
  };

  /**
   * Enhanced keyboard event handler with VS Code-like navigation behavior
   * Handles special keys and navigation with custom scrolling logic
   */
  const handleKeyDown = (e) => {
    // Arrow keys need special handling for scrolling
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      // Don't prevent default - let the browser move the caret
      // But capture starting position to calculate where to scroll
      const textarea = textareaRef.current;
      if (textarea) {
        const currentPosition = textarea.selectionStart;
        const currentValue = textarea.value;

        // Let the default browser behavior happen first
        // HIDDEN LOGIC: requestAnimationFrame ensures we act after browser updates
        requestAnimationFrame(() => {
          const newPosition = textarea.selectionStart;

          // Only apply our custom scrolling if the position actually changed
          if (newPosition !== currentPosition) {
            // Calculate the line number based on the new position
            const textBeforeCursor = currentValue.substring(0, newPosition);
            const lines = textBeforeCursor.split('\n');
            const lineNumber = lines.length;

            // Apply our custom scrolling directly
            ensureCaretVisible(lineNumber);
          }
        });
      }
    }

    // Other navigation keys
    const otherNavKeys = ["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"];
    if (otherNavKeys.includes(e.key)) {
      // Use requestAnimationFrame instead of setTimeout for better timing
      requestAnimationFrame(updateCaretInfo);
    }

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
        updateCaretInfo();
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

  /**
   * Additional handler for keyup events
   * Only handles non-arrow navigation keys as arrow keys are handled in keyDown
   */
  const handleKeyUp = (e) => {
    // We only need to update caret info for non-arrow keys here
    // Arrow key handling is already done in keyDown with requestAnimationFrame
    const nonArrowNavKeys = ["Home", "End", "PageUp", "PageDown"];
    if (nonArrowNavKeys.includes(e.key)) {
      updateCaretInfo();
    }
  };

  /**
   * Handle mouse events to update caret position
   */
  const handleMouseUp = () => {
    updateCaretInfo();
  };

  // =========== TRANSLATION AND SENDING ===========

  /**
   * Translates the selected text into the specified language
   */
  const handleTranslate = async (lang) => {
    if (!selectedText.trim()) return;
    const translation = await translateText(selectedText, lang);
    setTranslatedText(translation);
  };

  /**
   * Handles sending a message or note
   * 
   * @param {boolean} isNote - Whether to send as a note (true) or question (false)
   */
  const handleSend = (isNote = false) => {
    if (isNote) {
      setInput('');
      onSend(input, isNote);
      return
    }
    if (!selectedText.trim()) return;

    onSend(selectedText, isNote);
    setSelectedText('');
    setTranslatedText('');
  };

  // =========== TEXT FORMATTING HELPERS ===========

  /**
   * Applies markdown formatting to selected text or at cursor position
   * 
   * @param {string} prefix - The markdown prefix to add
   * @param {string} suffix - The markdown suffix to add
   */
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
        updateCaretInfo();
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
        updateCaretInfo();
      }, 0);
    }
  };

  /**
   * Decodes HTML entities in text
   * Used to properly display translated text that may contain entities
   */
  function decodeHTML(html) {
    // to decode nbsp and etc
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  }

  // =========== COMPONENT RENDERING ===========

  return (
    <div className="message-input">
      <div className="text-area-with-toolbar">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onSelect={handleSelect}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onScroll={handleScroll}
          placeholder="Type your message... (Ctrl+B for bold, Ctrl+I for italic)"
          className="vs-code-textarea"
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
      <div className="caret-position">
        Ln {caretInfo.line}, Col {caretInfo.column}
      </div>
    </div>
  );
};

export default MessageInputWithToolbar;