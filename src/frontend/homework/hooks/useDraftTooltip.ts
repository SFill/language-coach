import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from 'react';
import { useFloating, autoUpdate, offset, flip, shift } from '@floating-ui/react';
import type { Editor } from '@tiptap/react';
import type { FeedbackTooltipData } from '../components/FeedbackTooltip';

export const FEEDBACK_HIGHLIGHT_SELECTOR = '[data-feedback]';

interface FeedbackAttrs {
  type: string;
  annotation?: string;
  word?: string;
  phonetic?: string;
}

// Read the `feedback` mark at a hovered/clicked highlight DOM span.
function getFeedbackMarkAt(editor: Editor | null, target: HTMLElement) {
  if (!editor) return null;
  const view = editor.view;
  const pos = view.posAtDOM(target, 0);
  if (pos == null) return null;
  const doc = editor.state.doc;
  const max = doc.content.size;
  const candidates = [pos + 1, pos, Math.max(pos - 1, 0)].filter((p) => p <= max);
  for (const p of candidates) {
    const resolved = doc.resolve(p);
    const mark = resolved.marks().find((m) => m.type.name === 'feedback');
    if (mark) return mark;
  }
  const node = doc.nodeAt(pos);
  if (node) {
    const mark = node.marks.find((m) => m.type.name === 'feedback');
    if (mark) return mark;
  }
  return null;
}

export interface TooltipState {
  anchorEl: HTMLElement | null;
  data: FeedbackTooltipData | null;
}

type FloatingApi = ReturnType<typeof useFloating>;

export interface UseDraftTooltipResult {
  tooltip: TooltipState;
  setTooltip: Dispatch<SetStateAction<TooltipState>>;
  hintsEnabled: boolean;
  toggleHints: () => void;
  handleHighlightHover: (event: MouseEvent, isOver: boolean) => void;
  handleHighlightClick: (event: MouseEvent) => void;
  floatingRefs: FloatingApi['refs'];
  floatingStyles: FloatingApi['floatingStyles'];
  update: FloatingApi['update'];
  tooltipHideTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

/**
 * Feedback-highlight tooltip interaction: hover/click to show an annotation
 * tooltip, a hints toggle, and floating-ui positioning (portaled, fixed
 * strategy so the .hw-editor scroll container can't clip it).
 *
 * The hover/click handlers are stable (useCallback [], reading refs) so they
 * can be passed into useEditor's handleDOMEvents, whose listeners Tiptap binds
 * once.
 */
export function useDraftTooltip({
  editorInstRef,
}: {
  editorInstRef: RefObject<Editor | null>;
}): UseDraftTooltipResult {
  const [tooltip, setTooltip] = useState<TooltipState>({ anchorEl: null, data: null });
  const tooltipHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const hintsEnabledRef = useRef(true);
  useEffect(() => { hintsEnabledRef.current = hintsEnabled; }, [hintsEnabled]);
  // Clear any pending tooltip hide timer on unmount (avoids a dangling setTimeout).
  useEffect(() => () => {
    if (tooltipHideTimerRef.current) clearTimeout(tooltipHideTimerRef.current);
  }, []);

  const readAttrs = (mark: NonNullable<ReturnType<typeof getFeedbackMarkAt>>): FeedbackTooltipData => {
    const attrs = mark.attrs as FeedbackAttrs;
    return {
      type: attrs.type as FeedbackTooltipData['type'],
      annotation: attrs.annotation || '',
      word: attrs.word || '',
      phonetic: attrs.phonetic || '',
    };
  };

  // Tooltip hover/click handlers — stable, read state via refs so the DOM event
  // listeners bound once by ProseMirror keep working.
  const handleHighlightHover = useCallback((event: MouseEvent, isOver: boolean) => {
    const target = (event.target as HTMLElement | null)?.closest(FEEDBACK_HIGHLIGHT_SELECTOR) as HTMLElement | null;
    if (!target) return;
    if (isOver) {
      if (!hintsEnabledRef.current) return;
      if (tooltipHideTimerRef.current) clearTimeout(tooltipHideTimerRef.current);
      const mark = getFeedbackMarkAt(editorInstRef.current, target);
      if (!mark) return;
      setTooltip({ anchorEl: target, data: readAttrs(mark) });
    } else {
      tooltipHideTimerRef.current = setTimeout(() => setTooltip({ anchorEl: null, data: null }), 200);
    }
  }, []);

  const handleHighlightClick = useCallback((event: MouseEvent) => {
    const target = (event.target as HTMLElement | null)?.closest(FEEDBACK_HIGHLIGHT_SELECTOR) as HTMLElement | null;
    if (!target) {
      setTooltip({ anchorEl: null, data: null });
      return;
    }
    if (!hintsEnabledRef.current) return;
    const mark = getFeedbackMarkAt(editorInstRef.current, target);
    if (!mark) return;
    setTooltip((prev) => prev.anchorEl === target
      ? { anchorEl: null, data: null }
      : { anchorEl: target, data: readAttrs(mark) });
  }, []);

  // Toggle hints on/off; clear any visible tooltip when turning hints OFF.
  const toggleHints = useCallback(() => {
    const turningOff = hintsEnabledRef.current;
    setHintsEnabled((prev) => !prev);
    if (turningOff) setTooltip({ anchorEl: null, data: null });
  }, []);

  // Floating tooltip positioning (portaled, fixed strategy -> no scroll clipping).
  const { refs, floatingStyles, update } = useFloating({
    placement: 'bottom',
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
  });
  useEffect(() => {
    if (tooltip.anchorEl) {
      refs.setReference(tooltip.anchorEl);
      // Compute now (the reference is already in the DOM) and again after paint,
      // in case fonts/layout shift the anchor's rect after first commit.
      update();
      const raf = requestAnimationFrame(update);
      return () => cancelAnimationFrame(raf);
    }
    refs.setReference(null);
  }, [tooltip.anchorEl, refs, update]);

  return {
    tooltip,
    setTooltip,
    hintsEnabled,
    toggleHints,
    handleHighlightHover,
    handleHighlightClick,
    floatingRefs: refs,
    floatingStyles,
    update,
    tooltipHideTimerRef,
  };
}

export default useDraftTooltip;