/**
 * Reconcile AI feedback highlight segments against the current draft text.
 *
 * Uses character-level diff (LCS) to determine which highlights are still valid
 * (their text is unchanged in the draft) and which are stale (edited by the user).
 *
 * Preserved highlights keep their annotation data; stale ones become plain text.
 *
 * @param {Array} segments — AI feedback segments [{text, type, annotation?, word?, phonetic?}]
 * @param {string} draftText — Current draft text from the backend
 * @returns {Array} Render chunks [{text, type, highlight, annotation?, word?, phonetic?}]
 */

const MAX_DIFF_LENGTH = 4000;

/**
 * Build a position map from original text to draft text using LCS-based diff.
 * Only "equal" (unchanged) positions are mapped; deleted positions are omitted.
 *
 * @param {string} oldText
 * @param {string} newText
 * @returns {Map<number, number>} originalPos → draftPos for kept characters
 */
function buildPositionMap(oldText, newText) {
  const m = oldText.length;
  const n = newText.length;

  if (m > MAX_DIFF_LENGTH || n > MAX_DIFF_LENGTH) {
    // Fallback: no position map — all highlights treated as stale
    return new Map();
  }

  // Build LCS length table (DP)
  const dp = new Array(m + 1);
  for (let i = 0; i <= m; i++) {
    dp[i] = new Uint16Array(n + 1);
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldText[i - 1] === newText[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find which original positions map to draft positions
  const map = new Map();
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (oldText[i - 1] === newText[j - 1]) {
      map.set(i - 1, j - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return map;
}

/**
 * Reconcile highlight segments against the current draft text.
 *
 * Algorithm:
 * 1. Concatenate segment texts to get the "original text" from the AI analysis.
 * 2. Diff original text vs draft text using LCS.
 * 3. For each highlight segment, check if all its characters map to contiguous
 *    unchanged positions in the draft (i.e., the user didn't edit that word/phrase).
 * 4. Preserved highlights are placed at their draft positions; stale ones become plain text.
 *
 * @param {Array} segments
 * @param {string} draftText
 * @returns {Array} chunks — ordered pieces of the draft text, each either plain or highlighted
 */
export function reconcileHighlights(segments, draftText) {
  const originalText = segments.map((s) => s.text || '').join('');
  const normalizedDraft = draftText.replace(/\r\n/g, '\n');

  // No edits at all — return segments as-is with highlight flag
  if (originalText === normalizedDraft) {
    return segments.map((seg) => ({
      text: seg.text,
      type: seg.type,
      highlight: seg.type !== 'plain',
      annotation: seg.annotation || undefined,
      word: seg.word || undefined,
      phonetic: seg.phonetic || undefined,
    }));
  }

  // Build the position map via diff
  const posMap = buildPositionMap(originalText, normalizedDraft);

  // Walk through segments, tracking original position.
  // For each highlight, check if its entire character range maps to
  // contiguous draft positions with matching text.
  let segStart = 0;
  const preserved = []; // { draftStart, draftEnd, segment }

  for (const seg of segments) {
    const segEnd = segStart + (seg.text || '').length;

    if (seg.type !== 'plain' && seg.text) {
      let allKept = true;
      let draftStart = -1;
      let prevDraftPos = -1;

      for (let pos = segStart; pos < segEnd; pos++) {
        const draftPos = posMap.get(pos);
        if (draftPos === undefined) {
          // This character was deleted/changed — highlight is stale
          allKept = false;
          break;
        }
        if (draftStart === -1) draftStart = draftPos;
        // Check contiguity: draft positions must be sequential
        if (prevDraftPos !== -1 && draftPos !== prevDraftPos + 1) {
          allKept = false;
          break;
        }
        prevDraftPos = draftPos;
      }

      // Verify the draft text at this position matches the segment text
      if (
        allKept &&
        draftStart !== -1 &&
        normalizedDraft.slice(draftStart, draftStart + seg.text.length) === seg.text
      ) {
        preserved.push({
          draftStart,
          draftEnd: draftStart + seg.text.length,
          segment: seg,
        });
      }
    }

    segStart = segEnd;
  }

  // Build render chunks from the draft text, inserting highlight spans
  // at preserved positions.
  const sorted = preserved.sort((a, b) => a.draftStart - b.draftStart);
  const chunks = [];
  let pos = 0;

  for (const { draftStart, draftEnd, segment } of sorted) {
    // Plain text before this highlight
    if (draftStart > pos) {
      chunks.push({
        text: normalizedDraft.slice(pos, draftStart),
        type: 'plain',
        highlight: false,
      });
    }
    // The highlight itself
    chunks.push({
      text: segment.text,
      type: segment.type,
      highlight: true,
      annotation: segment.annotation || undefined,
      word: segment.word || undefined,
      phonetic: segment.phonetic || undefined,
    });
    pos = draftEnd;
  }

  // Remaining plain text after last highlight
  if (pos < normalizedDraft.length) {
    chunks.push({
      text: normalizedDraft.slice(pos),
      type: 'plain',
      highlight: false,
    });
  }

  // Edge case: no preserved highlights — return entire draft as one plain chunk
  if (chunks.length === 0) {
    chunks.push({
      text: normalizedDraft,
      type: 'plain',
      highlight: false,
    });
  }

  return chunks;
}