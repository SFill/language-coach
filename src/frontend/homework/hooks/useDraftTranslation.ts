import { useCallback, useEffect, useState } from 'react';
import { translateText } from '../../api';

export type TranslateLang = 'ru' | 'en' | 'es';

export interface UseDraftTranslationResult {
  translatedText: string;
  isTranslating: boolean;
  activeLang: TranslateLang | null;
  handleTranslate: (lang: TranslateLang) => Promise<void>;
}

// Decode Google's translateHtml response into plain text: <br> → newline, then decode HTML
// entities via the textarea trick. Mirrors MessageInput/hooks/useTextSelection.js:282.
function decodeHTML(html: string): string {
  if (!html) return '';
  const withNewlines = html.replace(/<br\s*\/?> ?/gi, '\n');
  const txt = document.createElement('textarea');
  txt.innerHTML = withNewlines;
  return txt.value;
}

/**
 * Translation for the homework selection toolbar. Translates the current editor selection
 * (plain text, supplied by useDraftSelectionToolbar's hwSelectedText) via the existing
 * `translateText` (POST /api/translate, Google Translate) and exposes the result for display.
 *
 * Translation-only: the editor text is never replaced. A new selection discards the stale
 * translation (the reset effect rides on `selectedText`).
 */
export function useDraftTranslation({ selectedText }: { selectedText: string }): UseDraftTranslationResult {
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [activeLang, setActiveLang] = useState<TranslateLang | null>(null);

  // A new selection makes any previous translation stale — drop it.
  useEffect(() => {
    setTranslatedText('');
    setActiveLang(null);
  }, [selectedText]);

  const handleTranslate = useCallback(async (lang: TranslateLang) => {
    if (!selectedText || !selectedText.trim()) return;
    setIsTranslating(true);
    setActiveLang(lang);
    try {
      // Google's translateHtml expects HTML; convert newlines to <br>.
      const input = selectedText.replace(/\n/g, '<br/>');
      const result = await translateText(input, lang);
      setTranslatedText(decodeHTML(result));
    } catch (err) {
      console.error('Translation error:', err);
      setTranslatedText('');
    } finally {
      setIsTranslating(false);
    }
  }, [selectedText]);

  return { translatedText, isTranslating, activeLang, handleTranslate };
}

export default useDraftTranslation;