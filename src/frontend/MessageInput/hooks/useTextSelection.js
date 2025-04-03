import { useState, useCallback } from 'react';
import { translateText } from '../../api'; // Adjust path as needed

/**
 * Hook to manage text selection and translation
 * 
 * @param {string} text - The full text content
 * @param {Function} updateCaretInfo - Function to update caret position
 * @returns {Object} Selection-related state and functions
 */
const useTextSelection = (text, updateCaretInfo) => {
  const [selectedText, setSelectedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');

  /**
   * Handles text selection in the textarea
   */
  const handleSelect = useCallback((e) => {
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const sel = text.substring(start, end);
    
    if (sel.length > 0) {
      setSelectedText(sel);
      setTranslatedText('');
    }
    
    updateCaretInfo();
  }, [text, updateCaretInfo]);

  /**
   * Translates the selected text into the specified language
   */
  const handleTranslate = useCallback(async (lang) => {
    if (!selectedText.trim()) return;
    
    try {
      const translation = await translateText(selectedText, lang);
      setTranslatedText(translation);
    } catch (error) {
      console.error('Translation error:', error);
      // Could set an error state here if needed
    }
  }, [selectedText]);

  /**
   * Clears selection and translation state
   */
  const clearSelection = useCallback(() => {
    setSelectedText('');
    setTranslatedText('');
  }, []);

  /**
   * Decodes HTML entities in text (for translated content)
   */
  const decodeHTML = useCallback((html) => {
    if (!html) return '';
    
    // Use textarea trick to decode HTML entities
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  }, []);

  return {
    selectedText,
    handleSelect,
    handleTranslate,
    clearSelection,
    decodeHTML,
    displayText: decodeHTML(translatedText || selectedText)
  };
};

export default useTextSelection;