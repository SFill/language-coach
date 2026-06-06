# Homework UI — End-to-End Evaluation Prompt

You are evaluating the homework feature of a language-coach web application. You are a different model from previous iterations and have image capabilities, allowing you to analyze screenshots directly. You have access to Playwright MCP tools for browser automation. The dev server runs at `http://localhost:5173`. The backend runs at `http://localhost:8000`.

You will perform three phases in sequence. After each phase, write a brief summary before moving on.

**Critical rule: after every navigation or interaction, check for console errors.** If you find any JavaScript errors (not just network 404s or backend-connection timeouts), **stop the current phase immediately** and report them. Only continue if the error list is clean or contains only transient network failures to `localhost:8000`.

To check errors, use `browser_console_messages({ level: "error" })` after each action. Filter out any errors whose text contains `localhost:8000`, `ERR_CONNECTION_REFUSED`, or `Failed to fetch` — those are expected backend-connection noise. If anything else remains, **halt and report**.

---

## Phase 1 — Teacher: Create & Import Exercise

You are a Spanish language teacher creating homework for an intermediate student.

### 1.1 Navigate to the homework page

1. Set viewport to 1920×1280.
2. Navigate to `http://localhost:5173/homework`.
3. **Check console errors.** If any real JS errors exist (not backend-connection), stop here and report.
4. Take a screenshot — confirm you see the import workspace (cloud upload icon, "Paste Text" button, drag-drop zone).

### 1.2 Open the paste modal

1. Click the "Paste Text" button.
2. Verify the paste modal opened — it should have a contentEditable area with placeholder text "Paste content here (Ctrl+V)...".
3. **Check console errors.** Halt if any real errors.

### 1.3 Paste a rich-text exercise

Use `browser_evaluate` to simulate pasting rich HTML into the contentEditable area. Paste this exercise:

```html
<h2>Exercise 1: Formal Letter</h2>
<p>Write a formal email (80–120 words) to a hotel in Madrid requesting a reservation. Include: dates, room type, number of guests, and any special requests. Use formal register (usted).</p>

<h2>Exercise 2: Opinion Essay</h2>
<p>Write a short essay (100–150 words) expressing your opinion on whether social media does more harm than good. Use at least three connector words (sin embargo, además, por lo tanto) and the subjunctive mood at least twice.</p>

<h2>Exercise 3: Creative Description</h2>
<p>Describe a bustling market scene using vivid sensory details (sight, sound, smell, touch). Minimum 60 words. Try to use at least two instances of the gerund (ando/iendo) and two superlatives (-ísimo).</p>
```

Also make an html and past content from agents/assigment_text.md and agents/exercise.png
like `<p>Exercise text here</p><img src="data:image/png;base64,..."><p>More text</p>`

Inject it by evaluating:

```js
(() => {
  const el = document.querySelector('.hw-paste-area');
  if (!el) throw new Error('Paste area not found');
  el.innerHTML = `<h2>Exercise 1: Formal Letter</h2><p>Write a formal email (80–120 words) to a hotel in Madrid requesting a reservation. Include: dates, room type, number of guests, and any special requests. Use formal register (usted).</p><h2>Exercise 2: Opinion Essay</h2><p>Write a short essay (100–150 words) expressing your opinion on whether social media does more harm than good. Use at least three connector words (sin embargo, además, por lo tanto) and the subjunctive mood at least twice.</p><h2>Exercise 3: Creative Description</h2><p>Describe a bustling market scene using vivid sensory details (sight, sound, smell, touch). Minimum 60 words. Try to use at least two instances of the gerund (ando/iendo) and two superlatives (-ísimo).</p>`;
  // Dispatch a custom paste event so the React handler parses segments
  const clipboardData = new DataTransfer();
  clipboardData.setData('text/html', el.innerHTML);
  clipboardData.setData('text/plain', el.innerText);
  const pasteEvent = new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true });
  el.dispatchEvent(pasteEvent);
  return { success: true, innerTextLength: el.innerText.length };
})()
```

After dispatching, check whether the segment preview appeared (should show "Detected N segments" with type icons). If the React handler didn't catch the synthetic event, try the fallback path:

```js
(() => {
  const previewVisible = !!document.querySelector('.hw-import-preview');
  const pasteAreaText = document.querySelector('.hw-paste-area')?.innerText?.length || 0;
  return { previewVisible, pasteAreaText };
})()
```

If preview is still not visible, use the drag-and-drop path: create a `.txt` file with the exercise text and use `browser_drop` or `browser_type` instead.

Take a screenshot of the preview state. **Check console errors. Halt if any real errors.**

### 1.4 Add an image exercise

Now add a fourth exercise that includes an image, so we can test the image-upload flow.

1. Close the current paste modal (click "Cancel" if still open) or navigate back to the import workspace if needed (go to `/homework`).
2. Click "Paste Text" again to open a fresh modal.
3. Paste the text exercise first by evaluating:

```js
(() => {
  const el = document.querySelector('.hw-paste-area');
  if (!el) throw new Error('Paste area not found');
  el.innerHTML = `<h2>Exercise 4: Describe the Image</h2><p>Look at the image below and write a detailed description in Spanish (60–90 words). Focus on what you see, where things are positioned, and the overall mood of the scene. Use prepositions of place (debajo de, encima de, al lado de, entre) and at least three adjectives.</p>`;
  const clipboardData = new DataTransfer();
  clipboardData.setData('text/html', el.innerHTML);
  clipboardData.setData('text/plain', el.innerText);
  const pasteEvent = new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true });
  el.dispatchEvent(pasteEvent);
  return { success: true, innerTextLength: el.innerText.length };
})()
```

4. Verify the preview shows at least one text segment.
5. Now drop the image file into the import area. Use `browser_drop` with:
   - `target`: the paste area or drop zone element
   - `paths`: `["/home/nikita/pets/language-coach/agents/exercise.png"]`
6. Check whether an image segment was added to the preview (should show a thumbnail with the 🖼 icon).
7. Screenshot the preview showing both text and image segments.
8. **Check console errors. Halt if any real errors.**

If the image drop doesn't work (e.g., the drop zone only accepts `.txt` files), note this in your report. The import workspace has a drag-and-drop zone that accepts files — try dropping onto `.hw-drop-zone` element as well.

### 1.5 Import the exercise

1. Click the "Import N segments" button.
2. Wait for navigation to `/homework/{noteId}` (the assignment view).
3. Screenshot — verify you see assignment cards on the left and a drafting area on the right.
4. Verify that the image exercise card shows a thumbnail or image indicator.
5. Take a screenshot and **visually verify** the image:
   - Is the image visible on the card?
   - Is it large enough to read/interpret, or is it a tiny thumbnail?
   - Is it clipped or cut off?
   - Is the aspect ratio correct (not stretched/squashed)?
6. **Check console errors. Halt if any real errors.**

**Phase 1 summary**: Did the import succeed? How many segments were detected (text + image)? Did the image upload work? Were there any UI glitches during paste or import? Were there any console errors?

---

## Phase 2 — Student: Complete Homework

You are an intermediate Spanish student doing the homework you just created.

### 2.1 Select an assignment

1. On the assignment list (left pane), identify the cards. Click the first one (Formal Letter).
2. Screenshot — confirm the assignment prompt appears in the right pane under "Assignment Prompt".
3. Read the prompt text and verify it matches what was pasted.
4. **Check console errors. Halt if any real errors.**

### 2.2 Write a draft

1. Click inside the editor area (the contentEditable div with class `hw-editor-content`).
2. Type a response to the formal letter exercise. Use this text:

```
Estimado señor Gerente,

Le escribo para solicitar una reservación en su hotel para el próximo mes de julio. Me gustaría reservar una habitación doble con vista al jardín para dos personas, del 15 al 22 de julio.

¿Sería posible incluir desayuno buffet en la reservación? También necesito información sobre el transporte desde el aeropuerto.

Muchas gracias por su atención.

Atentamente,
Maria López
```

3. Check the word count updates in the footer (should show ~70 words).
4. Screenshot the editor with your text.
5. **Check console errors. Halt if any real errors.**

### 2.3 Submit the draft

1. Click the "Submit" button.
2. Wait 2–3 seconds for the submission to complete.
3. Screenshot — verify the draft was submitted (the button should return to normal state).
4. **Check console errors. Halt if any real errors.**

### 2.4 Run AI Check

1. Click the "AI Check" button.
2. Wait for the analysis to complete (may take 5–10 seconds — the backend calls an LLM).
3. Screenshot — look for colored highlight segments in the editor (vocab, correct, suggestion types).
4. Verify the feedback rendered properly: vocabulary words highlighted, suggestions visible.
5. **Check console errors. Halt if any real errors.**

### 2.5 Ask a Q&A question

1. Switch to the "AI Q&A" tab by clicking it.
2. Type a question in the input field: "Should I use 'reservación' or 'reserva' in this context?"
3. Press Enter or click the send button.
4. Wait for the answer to appear.
5. Screenshot the Q&A panel showing your question and the AI's answer.
6. **Check console errors. Halt if any real errors.**

### 2.6 Switch assignments

1. Click the second assignment card (Opinion Essay).
2. Verify the drafting area updates — the prompt changes, the editor should be empty.
3. Screenshot.
4. **Check console errors. Halt if any real errors.**

### 2.7 Image exercise — view and respond

1. Click the assignment card for Exercise 4 (Describe the Image).
2. Verify the assignment prompt appears and references an image. Check whether the image renders in the prompt area or as a thumbnail on the card.
3. Take a screenshot and **visually verify** the exercise image:
   - Can you clearly see the image content (not a broken icon, not blank)?
   - Is it large enough that a student could actually interpret what the image shows?
   - Is the image fully visible (not clipped, not cut off, no overflow)?
   - Is the aspect ratio correct (not stretched or squashed)?
4. Screenshot the image exercise card and prompt.
5. Type a short description in the editor:

```
En la imagen se ve una escena muy interesante. Hay varios elementos que llaman la atención. El ambiente parece tranquilo y las personas están disfrutando del momento.
```

5. Submit the draft.
6. **Check console errors. Halt if any real errors.**

**Phase 2 summary**: Could you complete all student actions? Which steps worked smoothly? Which had friction (slow, confusing, broken)? Did the image exercise display correctly?

---

## Phase 3 — UI/UX Interview

Now step back and evaluate the overall homework experience as a UX reviewer. For each dimension, write a structured verdict (1–5 rating + specific observations).

### 3.1 Navigation & Wayfinding

- Is it clear where you are at all times (import view vs. assignment view)?
- Can you easily find your way back to the list of assignments?
- Is the relationship between cards and the drafting area obvious?

### 3.2 Assignment Interaction

- Is the assignment prompt clearly readable? Is it too long/short/unclear?
- Does the word count provide useful feedback?
- Is the editor comfortable to write in (toolbar visible, autosave indicator meaningful)?
- Are the formatting toolbar buttons functional? (Test bold: select text → click bold → verify it formats)
- **Image exercises**: Do images display correctly in assignment cards and in the prompt area? Are they sized appropriately — not too large, not clipped? Is the image-to-text relationship clear? Can the student actually read/interpret the image content, or is it too small / blurred / cropped?

### 3.3 Feedback & AI Check

- Did the AI Check feedback render clearly? Were highlights distinguishable (vocab vs. correct vs. suggestion)?
- Is it obvious what action to take after seeing AI feedback (can you edit and re-check)?
- Was the loading state clear during analysis?

### 3.4 Q&A Experience

- Is it obvious how to ask a question?
- Does the Q&A panel feel like a natural part of the workflow, or does it feel disconnected?
- Are answers readable and well-formatted?

### 3.5 Visual Design & Accessibility

- Run an axe-core accessibility check via `browser_evaluate`:
  ```js
  (async () => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js';
    document.head.appendChild(script);
    await new Promise(r => script.onload = r);
    const results = await window.axe.run();
    return { violations: results.violations.length, incomplete: results.incomplete.length, passes: results.passes.length };
  })()
  ```
- Check color contrast, button sizes, hover/focus states.
- Is the layout responsive enough? Check for overflow issues.

### 3.6 Layout & Performance

- Evaluate: `document.documentElement.scrollWidth > document.documentElement.clientWidth` (should be false — no horizontal overflow).
- Check for any visual jank, layout shifts, or unnecessary re-renders during interactions.
- Did any interactions cause noticeable lag?

### 3.7 Critical Bugs

- List any console errors that are NOT backend-connection related.
- List any interactions that failed silently (button click → nothing happens).
- List any state inconsistencies (e.g., switching assignments doesn't clear the editor).

---

## Final Deliverable

Write a structured report:

```
# Homework UI Evaluation Report

## Phase 1 — Teacher
- Import success: ✅/❌
- Segments detected: N (text + image)
- Image upload: ✅/❌
- Image visible in preview: ✅/❌ (loaded, correct size, not clipped)
- Console errors: [list or "none"]
- Issues: [list]

## Phase 2 — Student
- Draft writing: ✅/❌
- Submission: ✅/❌
- AI Check: ✅/❌
- Q&A: ✅/❌
- Assignment switching: ✅/❌
- Image exercise display: ✅/❌ (image loaded, readable, not clipped/distorted)
- Console errors: [list or "none"]
- Issues: [list]

## Phase 3 — UX Ratings
| Dimension                     | Rating (1–5) | Notes |
| ----------------------------- | ------------ | ----- |
| Navigation & wayfinding       | X            | ...   |
| Assignment interaction        | X            | ...   |
| Feedback & AI check           | X            | ...   |
| Q&A experience                | X            | ...   |
| Visual design & accessibility | X            | ...   |
| Layout & performance          | X            | ...   |

## Critical Bugs
1. ...
2. ...

## Top 3 Recommendations
1. ...
2. ...
3. ...
```

**Error halt rule**: At every step, after checking console errors, if you find any real JavaScript error (not `localhost:8000` network failures, `ERR_CONNECTION_REFUSED`, or `Failed to fetch`), stop the current phase immediately, note which action caused it, include the error text, and move to the next phase or to the final report if the error blocks further progress.

Take your time on each phase. Be thorough — click every button, try every tab, look for edge cases. If something breaks, note exactly what happened and continue to the next step only if the error is a non-blocking network issue.