/**
 * Parse HTML from a paste event into exercises.
 *
 * An exercise is a label (an `ej.N` marker) plus the image(s) that follow it,
 * with any intervening non-marker body text merged into the exercise. When a
 * marker has more than one image, each image becomes its own exercise labelled
 * `ej.N(1)`, `ej.N(2)`, … Content with no preceding marker becomes a single
 * (unlabelled) exercise.
 *
 * Example — `<p>ej.1</p><img/><p>ej.2</p><img/><img/>` →
 *   [ ej.1, ej.2(1), ej.2(2) ].
 *
 * @param {string} html — raw HTML from clipboardData.getData('text/html')
 * @returns {Array<{ type: 'exercise', text: string, images: string[] }>}
 */
export function parseClipboardHTML(html) {
  const flat = walkToFlatSegments(html);
  return groupIntoExercises(flat);
}

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const BLOCK_TAGS = ['P', 'DIV', 'BR', 'LI', 'TR'];
const MARKER_RE = /^\s*ej\.?\s*(\d+)/i;

/**
 * Walk the DOM depth-first, collecting text and images in document order as
 * flat segments. Adjacent text is merged; images are separate segments.
 * Headings flush the current text buffer and seed the next one.
 */
function walkToFlatSegments(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const segments = [];
  let textBuffer = '';

  function flushText() {
    const trimmed = textBuffer.trim();
    if (trimmed) segments.push({ type: 'text', content: trimmed });
    textBuffer = '';
  }

  function walk(node) {
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IMG') {
      const src = node.getAttribute('src') || '';
      if (src) {
        flushText();
        segments.push({ type: 'image', content: '', src });
      }
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent.trim()) textBuffer += node.textContent;
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      if (HEADING_TAGS.has(node.tagName)) {
        flushText();
        textBuffer += node.textContent + '\n';
        return;
      }
      if (BLOCK_TAGS.includes(node.tagName) && textBuffer.length > 0) textBuffer += '\n';
      for (const child of node.childNodes) walk(child);
      if (BLOCK_TAGS.includes(node.tagName)) textBuffer += '\n';
    }
  }

  for (const child of doc.body.childNodes) walk(child);
  flushText();
  return segments;
}

/**
 * Group flat text/image segments into exercises.
 * A text segment matching `ej.N` starts a new exercise; following images and
 * non-marker text attach to it until the next marker. A marker with k>1 images
 * splits into `ej.N(1)` … `ej.N(k)`.
 */
function groupIntoExercises(segments) {
  const groups = [];
  let current = null;
  const flush = () => {
    if (current) groups.push(current);
    current = null;
  };

  for (const seg of segments) {
    if (seg.type === 'text') {
      const m = seg.content.match(MARKER_RE);
      if (m) {
        flush();
        const base = 'ej.' + m[1];
        const rest = seg.content.slice(m[0].length).trim();
        current = { base, text: rest ? `${base} ${rest}` : base, images: [] };
      } else if (current) {
        current.text += (current.text ? '\n' : '') + seg.content;
      } else {
        current = { base: null, text: seg.content, images: [] };
      }
    } else if (seg.type === 'image' && seg.src) {
      if (current) current.images.push(seg.src);
      else current = { base: null, text: '', images: [seg.src] };
    }
  }
  flush();

  const exercises = [];
  for (const g of groups) {
    if (g.images.length <= 1) {
      exercises.push({ type: 'exercise', text: g.text, images: g.images });
    } else {
      const base = g.base || 'Image';
      g.images.forEach((src, i) => {
        exercises.push({ type: 'exercise', text: `${base}(${i + 1})`, images: [src] });
      });
    }
  }
  return exercises;
}

/**
 * Convert an image source (data URI or URL) to a File object for upload.
 *
 * @param {string} src — data:image/png;base64,... or https:// URL
 * @returns {Promise<File|null>} — File object or null if fetch fails
 */
export async function imageSrcToFile(src) {
  try {
    // Data URI — decode directly
    if (src.startsWith('data:')) {
      const res = await fetch(src);
      const blob = await res.blob();
      const ext = blob.type.split('/')[1] || 'png';
      return new File([blob], `pasted-image-${Date.now()}.${ext}`, { type: blob.type || 'image/png' });
    }

    // Remote URL — fetch then convert
    const res = await fetch(src, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const ext = blob.type.split('/')[1] || 'png';
    return new File([blob], `pasted-image-${Date.now()}.${ext}`, { type: blob.type || 'image/png' });
  } catch (e) {
    console.error('Failed to convert image src to file:', e);
    return null;
  }
}