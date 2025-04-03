import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for implementing VS Code-like scrolling behavior in a textarea
 * 
 * @param {Object} textareaRef - React ref for the textarea element
 * @param {Function} calculateTotalVisualLines - Function to calculate total lines
 * @param {Function} calculateVisualLine - Function to calculate visual line for a position
 * @param {Function} updateCaretInfo - Function to update caret position info
 * @param {string} text - Current text content
 * @returns {Object} Scroll-related functions and state
 */
const useScrollBehavior = (
  textareaRef, 
  calculateTotalVisualLines,
  updateCaretInfo,
  text
) => {
  // CRITICAL: This must match the CSS line-height for accurate calculations
  const lineHeight = 20; // Approximate line height in pixels
  const [visibleLines, setVisibleLines] = useState(0);

  // Initialize and handle window resize for responsive behavior
  useEffect(() => {
    if (!textareaRef.current) return;
    
    // Calculate visible lines based on textarea height
    const height = textareaRef.current.clientHeight;
    setVisibleLines(Math.floor(height / lineHeight));

    // Add window resize handler for responsive behavior
    const handleResize = () => {
      if (textareaRef.current) {
        const height = textareaRef.current.clientHeight;
        setVisibleLines(Math.floor(height / lineHeight));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [textareaRef, lineHeight]);

  /**
   * Ensures caret remains visible with VS Code's margin behavior
   * 
   * @param {number} visualLine - The visual line number where the caret is located (1-based)
   * @param {boolean} forceScroll - Whether to force scrolling even if it seems unnecessary
   */
  const ensureCaretVisible = useCallback((visualLine, forceScroll = false) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    
    // Calculate total visual lines
    const totalVisualLines = calculateTotalVisualLines(textarea, text);

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

    // Determine if we should scroll
    const shouldScroll = 
      forceScroll || Math.abs(targetScrollTop - initialScrollTop) > 2;
    
    if (shouldScroll) {
      // Mark that we're scrolling programmatically
      textarea._isScrollingProgrammatically = true;
      
      // Apply the scroll
      textarea.scrollTop = targetScrollTop;
      
      // Reset the flag after a short delay
      setTimeout(() => {
        textarea._isScrollingProgrammatically = false;
      }, 10);
    }
  }, [textareaRef, calculateTotalVisualLines, visibleLines, lineHeight, text]);
  
  /**
   * Integrated function that updates caret info and ensures it's visible
   * This is the main function that provides VS Code-like behavior
   */
  const updateCaretAndScroll = useCallback((forceScroll = false) => {
    if (!textareaRef.current) return;
    
    // First update caret info to get latest position
    const info = updateCaretInfo(true);
    
    if (info) {
      // Then ensure the caret is visible with proper scrolling
      ensureCaretVisible(info.visualLine, forceScroll);
    }
  }, [updateCaretInfo, ensureCaretVisible]);

  /**
   * Handles wheel scrolling events
   */
  const handleWheel = useCallback((e) => {
    // Mark that we're scrolling via wheel
    if (textareaRef.current) {
      textareaRef.current._isScrollingByWheel = true;
      
      // Cancel any existing wheel timeout
      if (textareaRef.current._wheelTimeout) {
        clearTimeout(textareaRef.current._wheelTimeout);
      }
    }

    // Let the default wheel behavior happen first
    // We'll use a small delay to ensure scrolling is completed
    if (textareaRef.current) {
      textareaRef.current._wheelTimeout = setTimeout(() => {
        // After wheel scrolling has stabilized, update caret info
        // but don't change the scroll position
        updateCaretInfo(true);
        
        // Reset the flag
        if (textareaRef.current) {
          textareaRef.current._isScrollingByWheel = false;
        }
      }, 100); // Longer timeout to ensure scrolling is complete
    }
  }, [textareaRef, updateCaretInfo]);

  /**
   * Handles general scroll events (scrollbar, programmatic scrolling)
   */
  const handleScroll = useCallback((e) => {
    // Skip if this is our own programmatic scrolling
    if (e.target._isScrollingProgrammatically) {
      return;
    }
    
    // Skip if this is from wheel events (handled separately)
    if (e.target._isScrollingByWheel) {
      return;
    }

    // Skip if this is from keyboard navigation (handled separately)
    if (e.target._isScrollingByKeyboard) {
      return;
    }

    // For manual scrollbar interactions, we need to debounce
    // to avoid excessive updates during fast scrolling
    if (textareaRef.current) {
      // Clear any existing scroll timer
      if (textareaRef.current._scrollTimer) {
        clearTimeout(textareaRef.current._scrollTimer);
      }
      
      // Set a timer to update position after scrolling stops
      textareaRef.current._scrollTimer = setTimeout(() => {
        // Just update the caret position indicator without changing scroll
        updateCaretInfo(true);
      }, 50); // Small delay to debounce scroll events
    }
  }, [updateCaretInfo, textareaRef]);

  return {
    updateCaretAndScroll,
    handleWheel,
    handleScroll,
  };
};

export default useScrollBehavior;