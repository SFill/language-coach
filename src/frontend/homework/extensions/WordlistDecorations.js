// Overlay highlight for words the user has added to a wordlist. Renders purple
// `.hw-vocab-highlight` spans over draft occurrences of the current language's
// wordlist words, with data-* attributes the tooltip reads.
//
// Uses ProseMirror decorations (virtual overlays) — NOT document marks — so the
// highlights don't touch the document, don't get saved into the plain-text draft,
// and don't conflict with the AI-check `feedback` marks. The decoration set is
// rebuilt only when the wordlist words change (re-scan on page load / toolbar
// add); on plain typing transactions it is just mapped (positions follow edits)
// so newly typed occurrences are NOT highlighted live ("no active rendering
// while typing").
//
// The current words are kept in a WeakMap keyed by editor so they survive the
// content loader's `editor.view.updateState(EditorState.create(...))`, which
// re-initializes plugin state (and would otherwise wipe the decorations on every
// content reload). `init` rebuilds the set from the stored words + the new doc.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const key = new PluginKey('wordlist-decorations');

// Persist the latest words per editor across EditorState re-creation.
const wordsByEditor = new WeakMap();

// Whole-word, case-insensitive match check at a found index.
function isWordBoundary(text, start, end) {
  const before = start === 0 || /\W/.test(text[start - 1]);
  const after = end === text.length || /\W/.test(text[end]);
  return before && after;
}

// Scan the doc for occurrences of `words` and build a DecorationSet.
// words: Array<{ word: string; translation: string | null; example: string | null }>
function buildDecorations(doc, words) {
  if (!words || words.length === 0) return DecorationSet.empty;
  const needles = words
    .filter((w) => w && w.word && w.word.trim())
    .map((w) => ({ ...w, lower: w.word.toLowerCase() }));
  if (needles.length === 0) return DecorationSet.empty;

  const decos = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    const lower = text.toLowerCase();
    for (const n of needles) {
      let from = 0;
      while ((from = lower.indexOf(n.lower, from)) !== -1) {
        const end = from + n.lower.length;
        if (isWordBoundary(lower, from, end)) {
          decos.push(Decoration.inline(pos + from, pos + end, {
            class: 'hw-vocab-highlight',
            'data-wordlist': 'true',
            'data-word': n.word,
            'data-translation': n.translation || '',
            'data-example-phrase': n.example || '',
          }));
        }
        from = end;
      }
    }
  });
  return DecorationSet.create(doc, decos);
}

export const WordlistDecorations = Extension.create({
  name: 'wordlistDecorations',

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key,
        state: {
          // init runs on EditorState.create (incl. the content loader's
          // updateState) — rebuild from the persisted words + this doc so a
          // content reload doesn't wipe the highlights.
          init: (config) => {
            const words = wordsByEditor.get(editor) || [];
            return { words, set: buildDecorations(config.doc, words) };
          },
          apply(tr, value) {
            const wordsMeta = tr.getMeta('wordlist-words');
            if (wordsMeta !== undefined) {
              const words = wordsMeta || [];
              return { words, set: buildDecorations(tr.doc, words) };
            }
            if (tr.docChanged) {
              // Follow edits without re-scanning — typed text isn't highlighted live.
              return { words: value.words, set: value.set.map(tr.mapping, tr.doc) };
            }
            return value;
          },
        },
        props: {
          decorations: (state) => key.getState(state)?.set || DecorationSet.empty,
        },
      }),
    ];
  },
});

// Push the current-language wordlist words into the editor and re-scan.
// A meta-only transaction (no doc change) — onTransaction ignores it, so it
// does NOT schedule an autosave. Also stashes the words so a later
// EditorState.create (content reload) can rebuild the decorations.
export function setWordlistWords(editor, words) {
  if (!editor || editor.isDestroyed) return;
  wordsByEditor.set(editor, words);
  editor.view.dispatch(editor.state.tr.setMeta('wordlist-words', words));
}

export default WordlistDecorations;