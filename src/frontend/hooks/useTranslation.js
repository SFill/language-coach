import { useState } from 'react';
import { translateText } from '../api';

/**
 * Custom hook for handling translation functionality
 * @returns {Object} - Translation utilities and state
 */
export const useTranslation = () => {
  const [translatedNode, setTranslatedNode] = useState(null);

  /**
   * Translates text within the current range
   */
  const translateInRange = async (range, textToTranslate, lang) => {
    if (!range || !textToTranslate.trim()) return null;

    const newTranslation = await translateText(textToTranslate, lang);
    range.deleteContents();

    const span = document.createElement('span');
    span.innerHTML = newTranslation;
    span.setAttribute('data-translated', 'true');
    span.setAttribute('data-original-text', textToTranslate);
    span.setAttribute('data-current-lang', lang);
    span.style.cursor = 'pointer';
    span.style.textDecoration = 'underline';
    span.style.textDecorationColor = 'blue';

    range.insertNode(span);
    return span;
  };

  /**
   * Updates an existing translation
   */
  const updateTranslation = async (node, lang) => {
    if (!node) return;

    const original = node.getAttribute('data-original-text');
    if (!original) return;

    const newTranslation = await translateText(original, lang);
    node.innerHTML = newTranslation;
    node.setAttribute('data-current-lang', lang);
  };

  /**
   * Reverts a translation to original text
   */
  const revertTranslation = (node) => {
    if (!node) return;

    const originalText = node.getAttribute('data-original-text');
    if (!originalText) return;
    node.innerHTML = originalText;

    const parent = node.parentNode;

    // Replace the translated span with the original text
    while (node.firstChild) {
      parent.insertBefore(node.firstChild, node);
    }

    parent.removeChild(node);
  };

  return {
    translatedNode,
    setTranslatedNode,
    translateInRange,
    updateTranslation,
    revertTranslation
  };
};
