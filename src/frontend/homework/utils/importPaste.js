/**
 * Parse HTML from a paste event into sequential segments.
 * Each segment is either text or an image, preserving document order.
 *
 * @param {string} html — raw HTML from clipboardData.getData('text/html')
 * @returns {Array<{ type: 'text'|'image', content: string, src?: string }>}
 */
export function parseClipboardHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  const segments = [];

  /**
   * Walk the DOM tree depth-first, collecting text and images in order.
   * Adjacent text is merged; images are separate segments.
   */
  function walk(node) {
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IMG') {
      // Flush any accumulated text before the image
      const src = node.getAttribute('src') || '';
      if (src) {
        // Merge any pending text before adding image
        flushText();
        segments.push({ type: 'image', content: '', src });
      }
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text.trim()) {
        textBuffer += text;
      }
      return;
    }

    // Element node — recurse children in order
    if (node.nodeType === Node.ELEMENT_NODE) {
      // Add line breaks for block-level elements
      const blockTags = ['P', 'DIV', 'BR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TR'];
      if (blockTags.includes(node.tagName) && textBuffer.length > 0) {
        textBuffer += '\n';
      }

      for (const child of node.childNodes) {
        walk(child);
      }

      // Close block elements with a newline
      if (blockTags.includes(node.tagName)) {
        textBuffer += '\n';
      }
    }
  }

  let textBuffer = '';

  function flushText() {
    const trimmed = textBuffer.trim();
    if (trimmed) {
      segments.push({ type: 'text', content: trimmed });
    }
    textBuffer = '';
  }

  for (const child of body.childNodes) {
    walk(child);
  }

  // Flush any remaining text
  flushText();

  return segments;
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