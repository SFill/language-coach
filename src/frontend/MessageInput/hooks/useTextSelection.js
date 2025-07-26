import { useState, useCallback, useRef, useEffect } from 'react';
import { translateText } from '../../api'; // Adjust path as needed

/**
 * Hook to manage text selection and translation with delay
 * 
 * @param {string} text - The full text content
 * @param {Function} updateCaretInfo - Function to update caret position
 * @param {string} initialPreferredLanguage - Initially preferred language from localStorage
 * @param {Function} onLanguageChange - Callback when language preference changes
 * @param {Function} onTextUpdate - Callback to update text content for multi-line translations
 * @param {Object} textareaRef - Reference to the textarea element
 * @returns {Object} Selection-related state and functions
 */
const useTextSelection = (text, 
  updateCaretInfo, 
  initialPreferredLanguage = 'en', 
  onLanguageChange = null, 
  onTextUpdate = null, 
  textareaRef = null, 
) => {
  const [selectedText, setSelectedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState(initialPreferredLanguage);
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectionInfo, setSelectionInfo] = useState({ start: 0, end: 0 });
  
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
      setSelectionInfo({ start, end });
      
      // Clear any existing translation timer
      if (translationTimer.current) {
        clearTimeout(translationTimer.current);
      }
      
      // Only schedule automatic translation for single-line selections
      if (preferredLanguage && !isMultiLine(sel) && !hasTranslationDelimiter(sel)) {
        // Reset the timer - will translate after the delay
        translationTimer.current = setTimeout(() => {
          translateToLanguage(preferredLanguage, sel, start, end);
        }, 700); // 700ms delay
      } else {
        // Just clear the translation if no language is set or multi-line
        setTranslatedText('');
      }
    }

    updateCaretInfo();
  }, [text, updateCaretInfo, preferredLanguage]);

  /**
   * Check if selected text contains multiple lines
   */
  const isMultiLine = useCallback((textToCheck) => {
    return textToCheck.includes('\n');
  }, []);

  /**
   * Check if selected text contains :: delimiter (already translated content)
   */
  const hasTranslationDelimiter = useCallback((textToCheck) => {
    return textToCheck.includes(' :: ');
  }, []);

  /**
   * Extract only the left part (original text) from lines with :: delimiter
   */
  const extractLeftPartOnly = useCallback((textToCheck) => {
    const lines = textToCheck.split('\n');
    return lines.map(line => {
      if (line.includes(' :: ')) {
        return line.split(' :: ')[0];
      }
      return line;
    }).join('\n');
  }, []);

  /**
   * Merge new translation with existing lines, preserving right parts where applicable
   */
  const mergeWithExistingTranslations = useCallback((originalSelection, newTranslation, start, end) => {
    const originalLines = originalSelection.split('\n');
    const newTranslationLines = newTranslation.split('\n');
    
    return originalLines.map((originalLine, index) => {
      const newTranslatedLine = newTranslationLines[index] || '';
      
      if (originalLine.includes(' :: ')) {
        // Line had existing translation, replace only the right part
        const leftPart = originalLine.split(' :: ')[0];
        return `${leftPart} :: ${newTranslatedLine}`;
      } else {
        // New translation
        if (originalLine.trim() && newTranslatedLine.trim()) {
          return `${originalLine} :: ${newTranslatedLine}`;
        } else {
          return originalLine; // Keep empty lines as is
        }
      }
    }).join('\n');
  }, []);

  /**
   * Translates text to the specified language
   * Private helper function used by handleTranslate
   */
  const translateToLanguage = async (lang, textToTranslate, start = null, end = null) => {
    if (!textToTranslate || !textToTranslate.trim()) return;
    
    setIsTranslating(true);

    const isMultiLineText = isMultiLine(textToTranslate);
    
    try {
      if (isMultiLineText && onTextUpdate && textareaRef?.current) {
        // Handle multi-line translation by replacing text in editor
        let textForTranslation = textToTranslate;
        
        // Check if selection contains existing translations (:: delimiter)
        if (hasTranslationDelimiter(textToTranslate)) {
          // Extract only the left part (original text) for translation
          textForTranslation = extractLeftPartOnly(textToTranslate);
        }
        
        const translationInput = textForTranslation.replaceAll(/\n/g, '<br/>');
        const translation = await translateText(translationInput, lang);
        const decodedTranslation = decodeHTML(translation);
        
        let formattedResult;
        
        if (hasTranslationDelimiter(textToTranslate)) {
          // Merge with existing translations
          formattedResult = mergeWithExistingTranslations(textToTranslate, decodedTranslation, start, end);
        } else {
          // Create new formatted pairs (line :: translated_line)
          const originalLines = textForTranslation.split('\n');
          const translatedLines = decodedTranslation.split('\n');
          
          formattedResult = originalLines.map((originalLine, index) => {
            const translatedLine = translatedLines[index] || '';
            if (originalLine.trim()) {
              return `${originalLine} :: ${translatedLine}`;
            } else {
              return originalLine; // Keep empty lines as is
            }
          }).join('\n');
        }
        
        // Replace the selected text with the formatted translation
        const newText = text.substring(0, start) + formattedResult + text.substring(end);
        onTextUpdate(newText);
        
        // Update cursor position after text replacement
        setTimeout(() => {
          const newCursorPos = start + formattedResult.length;
          textareaRef.current.setSelectionRange(start, newCursorPos);
        }, 10);
        
        // Clear selection since we replaced the text
        setSelectedText('');
        setTranslatedText('');
      } else {
        // Handle single line translation
        if (hasTranslationDelimiter(textToTranslate) && onTextUpdate && textareaRef?.current) {
          // Single line with existing translation - replace in editor
          const textForTranslation = extractLeftPartOnly(textToTranslate);
          const translationInput = textForTranslation.replaceAll(/\n/g, '<br/>');
          const translation = await translateText(translationInput, lang);
          const decodedTranslation = decodeHTML(translation);
          
          const formattedResult = mergeWithExistingTranslations(textToTranslate, decodedTranslation, start, end);
          
          // Replace the selected text with the updated translation
          const newText = text.substring(0, start) + formattedResult + text.substring(end);
          onTextUpdate(newText);
          
          // Update cursor position after text replacement
          setTimeout(() => {
            const newCursorPos = start + formattedResult.length;
            textareaRef.current.setSelectionRange(start, newCursorPos);
          }, 10);
          
          // Clear selection since we replaced the text
          setSelectedText('');
          setTranslatedText('');
        } else {
          // Show in toolbar for new single line translations
          const textForTranslation = textToTranslate.replaceAll(/\n/g, '<br/>');
          const translation = await translateText(textForTranslation, lang);
          setTranslatedText(translation);
        }
      }
    } catch (error) {
      console.error('Translation error:', error);
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
      translateToLanguage(lang, selectedText, selectionInfo.start, selectionInfo.end);
    }
  }, [selectedText, selectionInfo, onLanguageChange]);

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
   * Manually trigger translation for current selection (used for keyboard shortcuts)
   */
  const translateSelection = useCallback(() => {
    if (selectedText.trim() && preferredLanguage) {
      // Clear any existing translation timer
      if (translationTimer.current) {
        clearTimeout(translationTimer.current);
        translationTimer.current = null;
      }
      
      // Immediately translate the currently selected text
      translateToLanguage(preferredLanguage, selectedText, selectionInfo.start, selectionInfo.end);
    }
  }, [selectedText, preferredLanguage, selectionInfo]);

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

  /**
   * Decodes HTML entities in text (for translated content)
   */
  const prepareDisplayText = useCallback((text) => {
    if (isMultiLine(text) || hasTranslationDelimiter(text)) return ''
    return decodeHTML(text)
  }, []);

  return {
    selectedText,
    handleSelect,
    handleTranslate,
    clearSelection,
    translateSelection,
    decodeHTML,
    displayText: prepareDisplayText(translatedText || selectedText),
    preferredLanguage,
    isTranslating
  };
};

export default useTextSelection;