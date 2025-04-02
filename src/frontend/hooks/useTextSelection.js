import { useState, useRef, useEffect } from 'react';

/**
 * Custom hook for handling text selection within a container
 * @param {Function} onSelectionChange - Callback when selection changes
 * @returns {Object} - Selection utilities and state
 */
export const useTextSelection = (onSelectionChange) => {
  const containerRef = useRef(null);
  const [currentRange, setCurrentRange] = useState(null);
  const [selectedText, setSelectedText] = useState('');

  /**
   * Adjusts range to avoid translated spans
   */
  const adjustRange = (range) => {
    if (!range) return null;
    
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
   * Finds a translated parent node
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
   * Handles selection changes
   */
  const handleSelection = (e) => {
    e.stopPropagation();
    const selection = window.getSelection();
    
    if (selection && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const adjustedRange = adjustRange(range);
      
      if (adjustedRange && !adjustedRange.collapsed) {
        setCurrentRange(adjustedRange);
        
        let div = document.createElement('div');
        div.appendChild(adjustedRange.cloneContents());
        const text = div.innerHTML;
        
        setSelectedText(text);
        
        if (onSelectionChange) {
          const rect = adjustedRange.getBoundingClientRect();
          onSelectionChange(rect, text, false);
        }
      }
    }
  };

  /**
   * Global mouseup handler
   */
  useEffect(() => {
    const globalMouseUpHandler = (e) => {
      console.log(e)
      const selection = window.getSelection();
      if (
        selection &&
        !selection.isCollapsed &&
        containerRef.current &&
        (containerRef.current.contains(selection.anchorNode) && containerRef.current.contains(selection.focusNode))
      ) {
        handleSelection(e);
      }
    };

    document.addEventListener('mouseup', globalMouseUpHandler);
    return () => {
      document.removeEventListener('mouseup', globalMouseUpHandler);
    };
  }, [onSelectionChange]);

  return {
    containerRef,
    currentRange,
    selectedText,
    handleSelection,
    findTranslatedParent
  };
};
