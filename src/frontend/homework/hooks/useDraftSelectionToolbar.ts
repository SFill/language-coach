import { useCallback, useRef, useState, type RefObject } from 'react';
import { useWordlist } from '../../wordlist/WordlistContext';

export interface UseDraftSelectionToolbarResult {
  hwToolbarRef: RefObject<HTMLDivElement | null>;
  hwSelectedText: string;
  hwSelectedSentence: unknown;
  setHwSelectedText: (text: string) => void;
  setHwSelectedSentence: (sentence: unknown) => void;
  handleToolbarAddToList: (text: string, listId: string) => Promise<unknown>;
  handleToolbarMoveToList: (text: string, sourceListId: string, targetListId: string) => Promise<unknown>;
  handleToolbarCreateNewList: (text: string) => Promise<unknown>;
  wordlists: unknown;
}

/**
 * Selection-toolbar state + wordlist wiring for the editor's BubbleMenu.
 *
 * The setters are stable useState setters, so they can be passed into
 * useEditor's onSelectionUpdate (whose config is read once on first render).
 *
 * `noteName` is the active homework's title (Note.name); it is used as the
 * name of any wordlist created from this homework via the toolbar.
 */
export function useDraftSelectionToolbar(
  noteName: string | null = null,
): UseDraftSelectionToolbarResult {
  const hwToolbarRef = useRef<HTMLDivElement | null>(null);
  const [hwSelectedText, setHwSelectedText] = useState('');
  const [hwSelectedSentence, setHwSelectedSentence] = useState<unknown>(null);

  const {
    wordlists,
    addWordToList,
    moveWordBetweenLists,
    createNewListWithWord,
  } = useWordlist();

  // Selection toolbar handlers
  const handleToolbarAddToList = useCallback(async (text: string, listId: string) => {
    if (!text.trim()) return null;
    return addWordToList(text, listId, hwSelectedSentence);
  }, [addWordToList, hwSelectedSentence]);

  const handleToolbarMoveToList = useCallback(async (wordId: string, sourceListId: string, targetListId: string) => {
    if (!wordId || sourceListId === targetListId) return null;
    return moveWordBetweenLists(wordId, sourceListId, targetListId);
  }, [moveWordBetweenLists]);

  const handleToolbarCreateNewList = useCallback(async (text: string) => {
    if (!text.trim()) return null;
    return createNewListWithWord(text, noteName || null, hwSelectedSentence);
  }, [createNewListWithWord, hwSelectedSentence, noteName]);

  return {
    hwToolbarRef,
    hwSelectedText,
    hwSelectedSentence,
    setHwSelectedText,
    setHwSelectedSentence,
    handleToolbarAddToList,
    handleToolbarMoveToList,
    handleToolbarCreateNewList,
    wordlists,
  };
}

export default useDraftSelectionToolbar;