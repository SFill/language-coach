// Helpers to convert between the backend's plain-text draft contract (`\n`-joined
// text) / AI-feedback segment chunks and ProseMirror JSON documents.
//
// The draft block is stored and submitted as plain text with `\n` line breaks.
// AI-feedback segments are `{ text, type, annotation?, word?, phonetic? }` whose
// concatenated `text` must reproduce the draft exactly. Highlights become a
// `feedback` mark on the text node(s) carrying those same attributes.
import { EditorState } from '@tiptap/pm/state';

// Plain text ('\n' separated) -> doc JSON of paragraphs (one per line).
export function plainTextToDocJSON(text) {
  const t = (text || '').replace(/\r\n/g, '\n');
  if (t === '') return { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
  const lines = t.split('\n');
  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  };
}

// Render chunks ({text, type, highlight, annotation?, word?, phonetic?}) from
// reconcileHighlights/segments -> doc JSON. '\n' inside a chunk starts a new
// paragraph; highlight chunks become text nodes with a `feedback` mark.
export function chunksToDocJSON(chunks) {
  const paragraphs = [];
  let current = [];

  const flush = () => {
    paragraphs.push({ type: 'paragraph', content: current });
    current = [];
  };

  for (const chunk of chunks) {
    const lines = chunk.text.split('\n');
    lines.forEach((line, i) => {
      if (i > 0) flush(); // newline -> new paragraph
      if (!line) return;
      current.push(
        chunk.highlight
          ? {
              type: 'text',
              text: line,
              marks: [
                {
                  type: 'feedback',
                  attrs: {
                    type: chunk.type,
                    original: line,
                    annotation: chunk.annotation || null,
                    word: chunk.word || null,
                    phonetic: chunk.phonetic || null,
                  },
                },
              ],
            }
          : { type: 'text', text: line }
      );
    });
  }
  flush();
  if (paragraphs.length === 0) paragraphs.push({ type: 'paragraph', content: [] });
  return { type: 'doc', content: paragraphs };
}

// doc -> plain text with '\n' for paragraph boundaries and hard breaks.
// Guarantees exact round-trip with plainTextToDocJSON / the backend contract.
export function docToPlainText(doc) {
  const lines = [];
  doc.forEach((para) => {
    if (!para.isTextblock) {
      lines.push('');
      return;
    }
    let text = '';
    para.forEach((node) => {
      if (node.isText) text += node.text;
      else if (node.type.name === 'hardBreak') text += '\n';
    });
    lines.push(text);
  });
  return lines.join('\n');
}

// Sentence (within the textblock) containing the given document position.
export function sentenceAtPos(doc, pos) {
  const $pos = doc.resolve(pos);
  const para = $pos.parent;
  if (!para.isTextblock) return null;
  const text = para.textContent;
  const off = $pos.parentOffset;
  let start = 0;
  for (let i = off - 1; i >= 0; i--) {
    if (/[.!?]/.test(text[i])) { start = i + 1; break; }
  }
  let end = text.length;
  for (let i = off; i < text.length; i++) {
    if (/[.!?]/.test(text[i])) { end = i; break; }
  }
  const s = text.slice(start, end).trim();
  return s || null;
}

// Load content into the editor WITHOUT adding it to the undo history: replace
// the doc, then reset the EditorState so the history plugin starts fresh.
// (Loading a note/assignment should not be undoable.)
export function loadEditorContent(editor, docJSON) {
  if (!editor) return;
  editor.commands.setContent(docJSON);
  const fresh = EditorState.create({
    doc: editor.state.doc,
    plugins: editor.state.plugins,
    schema: editor.state.schema,
  });
  editor.view.updateState(fresh);
}

export function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}