import { useEditor, type Editor } from '@tiptap/react';
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import StarterKit from '@tiptap/starter-kit';
import { FeedbackMark } from '../extensions/FeedbackMark';
import { PlainTextPaste } from '../extensions/PlainTextPaste';
import { FeedbackStaleness } from '../extensions/FeedbackStaleness';
import { WordlistDecorations } from '../extensions/WordlistDecorations';
import { countWords, sentenceAtPos } from '../utils/draftDoc';

export interface UseDraftEditorArgs {
  handleHighlightHover: (event: MouseEvent, isOver: boolean) => void;
  handleHighlightClick: (event: MouseEvent) => void;
  scheduleAutosaveRef: RefObject<() => void>;
  suppressAutosaveRef: RefObject<boolean>;
  lastWordCountRef: MutableRefObject<number>;
  setWordCount: Dispatch<SetStateAction<number>>;
  setHwSelectedText: (text: string) => void;
  setHwSelectedSentence: (sentence: unknown) => void;
  segmentsStaleRef: MutableRefObject<boolean>;
  // Set true while the mouse button is held in the editor (a drag selection is
  // in progress) so the selection toolbar hides its content during the drag and
  // only appears on mouseup. Driven by React state (not the BubbleMenu plugin)
  // so the show on mouseup is instant — the plugin's shouldShow can't be
  // re-triggered without a selection change.
  setIsDragging: (dragging: boolean) => void;
}

/**
 * Owns the Tiptap editor instance + extension config. The handleDOMEvents
 * (highlight hover/click), onTransaction (word count + autosave schedule), and
 * onSelectionUpdate (selection-toolbar state) callbacks are wired to stable
 * refs/setters/useCallbacks supplied by the other hooks, so the once-created
 * editor always dispatches to fresh state.
 */
export function useDraftEditor({
  handleHighlightHover,
  handleHighlightClick,
  scheduleAutosaveRef,
  suppressAutosaveRef,
  lastWordCountRef,
  setWordCount,
  setHwSelectedText,
  setHwSelectedSentence,
  segmentsStaleRef,
  setIsDragging,
}: UseDraftEditorArgs): Editor | null {
  return useEditor({
    extensions: [
      StarterKit.configure({
        // Plain-text only: disable all formatting.
        bold: false, italic: false, strike: false, code: false, underline: false,
        heading: false, bulletList: false, orderedList: false, listItem: false,
        blockquote: false, horizontalRule: false, link: false, listKeymap: false,
        trailingNode: false,
        // Undo/redo: 100 entries, 500ms group delay (matches the old burst grouping).
        undoRedo: { depth: 100, newGroupDelay: 500 },
      }),
      FeedbackMark,
      FeedbackStaleness.configure({
        onStale: () => { segmentsStaleRef.current = true; },
      }),
      PlainTextPaste,
      WordlistDecorations,
    ],
    content: '<p></p>',
    editorProps: {
      attributes: { class: 'hw-editor-content' },
      handleDOMEvents: {
        mouseover: (_view, event) => handleHighlightHover(event as MouseEvent, true),
        mouseout: (_view, event) => handleHighlightHover(event as MouseEvent, false),
        click: (_view, event) => handleHighlightClick(event as MouseEvent),
        // Track drag state so the selection toolbar hides while the button is
        // held (no following-the-cursor during a drag) and reappears on mouseup.
        mousedown: () => setIsDragging(true),
        mouseup: () => setIsDragging(false),
      },
    },
    onTransaction: ({ editor: e, transaction }) => {
      if (!transaction.docChanged) return;
      // Guard: only setState when the count actually changed (React would bail
      // anyway, but this skips the getText() recompute on the next render path
      // and avoids needless re-renders for non-word-changing edits).
      const wc = countWords(e.getText());
      if (wc !== lastWordCountRef.current) {
        lastWordCountRef.current = wc;
        setWordCount(wc);
      }
      // Queue a debounced autosave (5s after the user stops editing) — but only
      // for genuine user edits, not for programmatic content loads.
      if (suppressAutosaveRef.current) return;
      scheduleAutosaveRef.current();
    },
    onSelectionUpdate: ({ editor: e }) => {
      const { from, to, empty } = e.state.selection;
      if (empty || from === to) {
        setHwSelectedText('');
        setHwSelectedSentence(null);
        return;
      }
      setHwSelectedText(e.state.doc.textBetween(from, to, '\n').trim());
      setHwSelectedSentence(sentenceAtPos(e.state.doc, from));
    },
  });
}

export default useDraftEditor;