// Inline mark for AI-feedback highlights (grammar / vocab / suggestion).
// Replaces the hand-rolled `<span class="hw-*-highlight" data-*>` elements.
// Carries the same `data-*` attributes the tests and tooltip read, and renders
// the existing highlight CSS classes so styles are unchanged.
import { Mark } from '@tiptap/core';

const CLASS_BY_TYPE = {
  grammar: 'hw-grammar-highlight',
  vocab: 'hw-vocab-highlight',
  suggestion: 'hw-highlight-suggestion',
};

export const FeedbackMark = Mark.create({
  name: 'feedback',
  inclusive: false, // typing adjacent to the mark does not extend it
  exitable: true, // arrow keys can leave the mark
  clearable: false, // not removable via unsetAllMarks (staleness plugin owns removal)

  addAttributes() {
    return {
      type: {
        default: 'plain',
        parseHTML: (el) => el.getAttribute('data-type'),
        renderHTML: (attrs) => (attrs.type ? { 'data-type': attrs.type } : {}),
      },
      original: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-original'),
        renderHTML: (attrs) => (attrs.original != null ? { 'data-original': attrs.original } : {}),
      },
      annotation: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-annotation'),
        renderHTML: (attrs) => (attrs.annotation ? { 'data-annotation': attrs.annotation } : {}),
      },
      word: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-word'),
        renderHTML: (attrs) => (attrs.word ? { 'data-word': attrs.word } : {}),
      },
      phonetic: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-phonetic'),
        renderHTML: (attrs) => (attrs.phonetic ? { 'data-phonetic': attrs.phonetic } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-feedback]' }];
  },

  renderHTML({ mark, HTMLAttributes }) {
    const cls = CLASS_BY_TYPE[mark.attrs.type];
    const attrs = { ...HTMLAttributes, 'data-feedback': '' };
    if (cls) attrs.class = cls;
    return ['span', attrs, 0];
  },
});