import { useState, useCallback, useRef, useEffect } from 'react';
import { translateText } from '../../api'; // Adjust path as needed

/**
 * Hook to manage text selection and translation with delay
 * 
 * @param {string} text - The full text content
 * @param {Function} updateCaretInfo - Function to update caret position
 * @param {string} initialPreferredLanguage - Initially preferred language from localStorage
 * @param {Function} onLanguageChange - Callback when language preference changes
 * @returns {Object} Selection-related state and functions
 */
const useTextSelection = (text, updateCaretInfo, initialPreferredLanguage = 'en', onLanguageChange = null) => {
  const [selectedText, setSelectedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState(initialPreferredLanguage);
  const [isTranslating, setIsTranslating] = useState(false);
  
  // Reference to store the translation timer
  const translationTimer = useRef(null);

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
      
      // Clear any existing translation timer
      if (translationTimer.current) {
        clearTimeout(translationTimer.current);
      }
      
      // Only schedule a translation if we have a preferred language
      if (preferredLanguage) {
        // Reset the timer - will translate after the delay
        translationTimer.current = setTimeout(() => {
          translateToLanguage(preferredLanguage, sel);
        }, 700); // 700ms delay
      } else {
        // Just clear the translation if no language is set
        setTranslatedText('');
      }
    }

    updateCaretInfo();
  }, [text, updateCaretInfo, preferredLanguage]);

  /**
   * Translates text to the specified language
   * Private helper function used by handleTranslate
   */
  const translateToLanguage = async (lang, textToTranslate) => {
    if (!textToTranslate || !textToTranslate.trim()) return;
    
    setIsTranslating(true);

    textToTranslate = textToTranslate.replaceAll(/\n/g,'<br/>')
    
    try {
      const translation = await translateText(textToTranslate, lang);
      setTranslatedText(translation);
    } catch (error) {
      console.error('Translation error:', error);
      // Could set an error state here if needed
    } finally {
      setIsTranslating(false);
    }
  };

  /**
   * Translates the selected text into the specified language
   */
  const handleTranslate = useCallback((lang) => {
    // Update the preferred language
    setPreferredLanguage(lang);
    
    // Notify parent component about language change if callback exists
    if (onLanguageChange) {
      onLanguageChange(lang);
    }
    
    // Clear any existing translation timer
    if (translationTimer.current) {
      clearTimeout(translationTimer.current);
      translationTimer.current = null;
    }
    
    // Immediately translate the currently selected text
    if (selectedText.trim()) {
      translateToLanguage(lang, selectedText);
    }
  }, [selectedText, onLanguageChange]);

  /**
   * Clears selection and translation state
   */
  const clearSelection = useCallback(() => {
    // Cancel any pending translation
    if (translationTimer.current) {
      clearTimeout(translationTimer.current);
      translationTimer.current = null;
    }
    
    setSelectedText('');
    setTranslatedText('');
    // Note: we don't clear preferredLanguage to remember the user's preference
  }, []);

  /**
   * Cleanup effect to clear timers on unmount
   */
  useEffect(() => {
    return () => {
      if (translationTimer.current) {
        clearTimeout(translationTimer.current);
      }
    };
  }, []);

  /**
   * Decodes HTML entities in text (for translated content)
   */
  const decodeHTML = useCallback((html) => {
    if (!html) return '';

    // First replace <br> tags with newlines
    let processed = html.replace(/<br\s*\/?> ?/gi, '\n');
    // Use textarea trick to decode HTML entities
    const txt = document.createElement('textarea');
    txt.innerHTML = processed;
    return txt.value;
  }, []);

  return {
    selectedText,
    handleSelect,
    handleTranslate,
    clearSelection,
    decodeHTML,
    displayText: decodeHTML(translatedText || selectedText),
    preferredLanguage,
    isTranslating
  };
};

export default useTextSelection;