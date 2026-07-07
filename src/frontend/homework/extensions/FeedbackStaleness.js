// Per-mark staleness: when the user edits the text inside a `feedback` mark so
// it no longer matches the mark's `original` snapshot, strip that mark only
// (others stay). Replaces the old handleEditorInput staleness loop and the
// blur cleanup of class-less spans — ProseMirror owns the DOM here.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const key = new PluginKey('feedbackStaleness');

export const FeedbackStaleness = Extension.create({
  name: 'feedbackStaleness',

  addOptions() {
    return { onStale: null };
  },

  addProseMirrorPlugins() {
    const onStale = this.options.onStale;
    return [
      new Plugin({
        key,
        appendTransaction(transactions, oldState, newState) {
          const docChanged = transactions.some((tr) => tr.docChanged);
          if (!docChanged) return null;
          const tr = newState.tr;
          let changed = false;
          newState.doc.descendants((node, pos) => {
            const fb = node.marks.find((m) => m.type.name === 'feedback');
            if (!fb) return;
            if (node.text !== fb.attrs.original) {
              tr.removeMark(pos, pos + node.nodeSize, fb.type);
              changed = true;
            }
          });
          if (changed && onStale) onStale();
          return changed ? tr : null;
        },
      }),
    ];
  },
});