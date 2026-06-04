import { test as base, expect } from '@playwright/test';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/coach';

interface NoteBlockPayload {
  id?: string;
  block: string;
  block_type?: string;
  role?: string;
  metadata_?: Record<string, unknown>;
  assignment_ref?: string;
  question_title?: string;
}

interface NoteBlock {
  id: string;
  block_type?: string;
  role?: string;
  assignment_ref?: string;
}

interface CreatedNote {
  id: number;
  name: string;
  note_blocks: NoteBlock[];
}

const api = axios.create({ baseURL: API_BASE });

/**
 * Create a homework note via the backend API.
 * Optionally adds assignment blocks, student drafts, and Q&A pairs.
 * Returns the full note and exposes the note ID early via the
 * `onNoteCreated` callback so cleanup can run even if block creation fails.
 */
async function createHomeworkNote(
  opts: {
    name?: string;
    assignments?: Array<{ text: string; metadata_?: Record<string, unknown> }>;
    drafts?: Array<{ text: string; assignmentIndex: number }>;
    questions?: Array<{ question: string; answer: string; assignmentIndex: number }>;
  },
  onNoteCreated?: (noteId: number) => void,
): Promise<CreatedNote> {
  const name = opts.name ?? `PW test ${Date.now()}`;

  const { data: note } = await api.post('/notes/', { name, history: { content: [] } });
  // Notify caller immediately so they can clean up even if block creation fails
  onNoteCreated?.(note.id);

  const assignmentIds: string[] = [];
  for (const a of opts.assignments ?? []) {
    const { data: blockData } = await api.post(`/notes/${note.id}/block`, {
      block: a.text,
      block_type: 'assignment',
      metadata_: a.metadata_ ?? {},
    } satisfies NoteBlockPayload);
    // API returns { status: "ok", new_note_blocks: [{ id: "uuid", ... }] }
    const blockId = blockData.new_note_blocks?.[0]?.id ?? blockData.id;
    if (blockId) assignmentIds.push(String(blockId));
  }

  for (const d of opts.drafts ?? []) {
    const ref = assignmentIds[d.assignmentIndex];
    if (!ref) throw new Error(`No assignment block at index ${d.assignmentIndex}`);
    await api.post(`/notes/${note.id}/block`, {
      block: d.text,
      block_type: 'simple_note',
      role: 'user',
      assignment_ref: ref,
    } satisfies NoteBlockPayload);
  }

  for (const q of opts.questions ?? []) {
    const ref = assignmentIds[q.assignmentIndex];
    if (!ref) throw new Error(`No assignment block at index ${q.assignmentIndex}`);
    // test_mode=true skips OpenAI call — answer is stored as-is from request body
    await api.post(`/notes/${note.id}/block?test_mode=true`, {
      block: q.answer,
      block_type: 'question',
      role: 'assistant',
      assignment_ref: ref,
      question_title: q.question,
    } satisfies NoteBlockPayload);
  }

  // Re-fetch to get the full note with all blocks
  const { data: fresh } = await api.get(`/notes/${note.id}`);
  return fresh;
}

/** Delete a note and all its blocks via the backend API. */
async function deleteNote(noteId: number): Promise<void> {
  await api.delete(`/notes/${noteId}`);
}

/**
 * Extended test fixture that provides `homeworkNote` — a note created
 * before the test and destroyed after, with assignment blocks, drafts, and Q&A pairs.
 *
 * Cleanup runs even if fixture setup or the test itself fails,
 * so no orphaned notes are left in the database.
 *
 * Usage:
 *   test('my test', async ({ homeworkNote }) => {
 *     await page.goto(`/homework/${homeworkNote.id}`);
 *     // ...assert...
 *   });
 */
export const test = base.extend<{
  homeworkNote: CreatedNote;
}>({
  homeworkNote: async ({}, use) => {
    let noteId: number | null = null;

    try {
      const note = await createHomeworkNote(
        {
          name: `PW drafting ${Date.now()}`,
          assignments: [
            {
              text: 'Write a short paragraph about your weekend. Include at least three activities you did.',
              metadata_: { category: 'Writing', difficulty: 'A2' },
            },
          ],
          drafts: [
            {
              text: 'Last weekend I went to the park and played football with my friends.',
              assignmentIndex: 0,
            },
          ],
          questions: [
            { question: 'Should I use past simple or past continuous?', answer: 'Use past simple for completed actions ("I went") and past continuous for actions in progress ("I was playing"). Both are correct here depending on emphasis.\n\n### When to Use Past Simple\nThe past simple describes actions that started and finished in the past. It is the default for narrating events: "I went to the park", "I played football". Use it for the main sequence of events in your paragraph.\n\n### When to Use Past Continuous\nThe past continuous sets the scene or describes an action that was interrupted: "I was walking to the park when it started raining". It gives background context.\n\n### Mixing Both\nA good paragraph often combines both: "Last weekend, I was walking to the park when I saw my friends, so we played football."', assignmentIndex: 0 },
            { question: 'How do I express "with my friends" more naturally?', answer: '"With my friends" is perfectly natural and commonly used. Here are some alternatives for variety:\n\n- **"with some friends"** — slightly more casual\n- **"with a group of friends"** — emphasizes the group\n- **"along with my friends"** — more formal\n- **"me and my friends"** — very informal, common in spoken English\n\n### Usage Tips\nIn writing, prefer "with my friends" or "with some friends". Avoid "me and my friends" in formal contexts — use "my friends and I" instead.', assignmentIndex: 0 },
            { question: 'Is "went to the park" too basic?', answer: 'It is perfectly fine for A2 level. However, if you want to sound more advanced, here are options:\n\n### Alternatives\n- **"headed to the park"** — natural, slightly more vivid\n- **"made my way to the park"** — suggests a journey\n- **"strolled to the park"** — implies a relaxed walk\n- **"dropped by the park"** — casual, unplanned visit\n\n### Level Guide\n- A1-A2: "went to", "walked to"\n- B1-B2: "headed to", "made my way to"\n- C1+: "wandered over to", "ambled across to"', assignmentIndex: 0 },
            { question: 'Can I start a sentence with "Last weekend"?', answer: 'Yes, "Last weekend" is a time expression that works well at the beginning of a sentence. Follow it with a comma: "Last weekend, I went to the park."\n\n### Time Expressions at the Start\nThis pattern is very common in English:\n- "Yesterday, I studied for three hours."\n- "Last Monday, we had a team meeting."\n- "In 2020, everything changed."\n\n### When to Use a Comma\nAlways use a comma after a time expression at the start of a sentence. It helps the reader separate the time reference from the main clause.', assignmentIndex: 0 },
            { question: 'How can I make the paragraph longer?', answer: 'Add details about each activity using the 5 Ws: who, what, when, where, why.\n\n### Expanding "I went to the park"\nInstead of just "I went to the park", try:\n"On Saturday morning, I went to Central Park with my friends because the weather was beautiful."\n\n### Adding Sensory Details\n- What did you see? "The park was full of cherry blossoms."\n- What did you hear? "Children were laughing on the playground."\n- How did you feel? "I felt relaxed and happy."\n\n### Adding Transitions\nUse connectors like "after that", "then", "meanwhile" to link your activities into a flowing narrative.\n\n### Example\n"Last weekend, I went to the park and played football with my friends. After that, we grabbed ice cream and sat by the lake. The sunset was amazing — golden light reflected off the water while we talked about our plans for the summer."', assignmentIndex: 0 },
            { question: 'What tense should I use for describing weekend activities?', answer: 'Past simple is the most common choice for describing completed weekend activities.\n\n### Common Patterns\n- **Completed actions**: "I went", "I played", "I watched" — past simple\n- **Background/ongoing**: "I was walking" — past continuous\n- **Habitual**: "I would go every Saturday" — "would" + infinitive\n\n### Mixing Tenses for Narrative Flow\nA natural paragraph mixes tenses:\n"I went to the park (simple). While I was playing football (continuous), my phone rang (simple). I had never played football there before (past perfect)."\n\n### Common Mistakes\n1. Using present tense for past events: ❌ "I go to the park" → ✅ "I went to the park"\n2. Overusing continuous: ❌ "I was going and was playing" → ✅ "I went and played"\n3. Forgetting the past perfect for earlier events: ❌ "I forgot my keys at home" → consider "I had left my keys at home"', assignmentIndex: 0 },
            { question: 'How do I structure a weekend narrative paragraph?', answer: 'A good narrative paragraph follows a clear structure: topic sentence → supporting details → conclusion.\n\n### Topic Sentence\nStart with an overview: "Last weekend was full of fun activities."\n\n### Supporting Details\nDescribe 2-3 activities in order:\n1. "First, I went to the park with my friends."\n2. "Then, we played football for two hours."\n3. "After that, we had lunch at a nearby café."\n\n### Concluding Sentence\nWrap up with a reflection: "It was one of the best weekends I have had in a long time."\n\n### Transition Words\nUse sequencing words: "first", "then", "after that", "finally", "meanwhile", "later".\nThese help the reader follow the chronological order of events.', assignmentIndex: 0 },
            { question: 'What vocabulary should I use for outdoor activities?', answer: 'Here are useful vocabulary groups for describing outdoor weekend activities:\n\n### Sports & Games\n- "played football", "kicked a ball around", "went jogging"\n- "rode my bike", "went swimming", "climbed"\n\n### Nature & Parks\n- "strolled through the park", "sat on the grass", "walked along the trail"\n- "picked flowers", "watched the sunset", "had a picnic"\n\n### Weather Expressions\n- "It was sunny and warm", "A gentle breeze was blowing"\n- "The sky was clear", "It was a beautiful day"\n\n### Feelings & Reactions\n- "I felt refreshed", "It was exhilarating", "I had a great time"\n- "I enjoyed every moment", "It was relaxing"', assignmentIndex: 0 },
            { question: 'Should I use contractions in my paragraph?', answer: 'Contractions are fine in informal writing and make your text sound natural.\n\n### Common Contractions\n- "I went" → no contraction needed (already short)\n- "I did not" → "I didn\'t"\n- "It was not" → "It wasn\'t"\n- "I have been" → "I\'ve been"\n- "We were not" → "We weren\'t"\n\n### When to Use Contractions\n- ✅ Informal writing: journal entries, emails to friends, casual essays\n- ✅ Spoken English: always use contractions\n- ❌ Formal writing: academic papers, business reports\n\n### Style Tip\nMix contracted and uncontracted forms for rhythm: "I didn\'t go to the park, but I have been thinking about it." This sounds more natural than using all contractions or all full forms.', assignmentIndex: 0 },
          ],
        },
        (id) => { noteId = id; },
      );
      await use(note);
    } finally {
      if (noteId !== null) {
        await deleteNote(noteId).catch(() => {});
      }
    }
  },
});

export { expect };