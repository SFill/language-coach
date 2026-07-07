// Force paste to insert plain text only (no formatting carried over from
// external sources), preserving blank lines. Flows through a normal ProseMirror
// transaction so it is undoable by the UndoRedo extension (Ctrl+Z after paste).
import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Fragment, Slice } from '@tiptap/pm/model';

export const PlainTextPaste = Extension.create({
  name: 'plainTextPaste',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste(view, event) {
            const cd = event.clipboardData;
            if (!cd) return false;
            let text = cd.getData('text/plain');
            if (!text) {
              // No plain-text representation — strip rich HTML to plain text so
              // formatting from external sources is never inserted.
              const html = cd.getData('text/html');
              if (html) {
                const temp = document.createElement('div');
                temp.innerHTML = html;
                text = temp.textContent || temp.innerText || '';
              }
            }
            if (!text) return false;
            const normalized = text.replace(/\r\n/g, '\n').split('\n');
            const paragraphs = normalized.map((line) =>
              view.state.schema.nodes.paragraph.create(null, line ? [view.state.schema.text(line)] : [])
            );
            const slice = Slice.maxOpen(Fragment.from(paragraphs));
            view.dispatch(view.state.tr.replaceSelection(slice));
            return true;
          },
        },
      }),
    ];
  },
});