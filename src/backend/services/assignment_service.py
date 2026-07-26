"""Service for analyzing student drafts and returning annotated segments."""

import json
import uuid
from datetime import datetime
from typing import List, Optional

from sqlmodel import Session, update
from fastapi import HTTPException

from backend.models.note import Note, NoteBlock, DraftSegment, AnalyzeResponse
from backend.services.openai_client import client, DEFAULT_MODEL

ASSIGNMENT_ANALYSIS_PROMPT = """You are a Spanish language tutor analyzing a student's writing draft. Your task is to annotate the draft text by breaking it into segments, each tagged with a type.

Segment types:
- "plain": Normal text with no issues
- "grammar": A grammar structure being practiced — a function word or structure such as a pronoun, verb form, preposition, or agreement. NOT vocabulary. Include "annotation" with the rule and why it applies to this span.
- "suggestion": An error or awkward phrasing that needs correction. Include "annotation" with the corrected version and a brief explanation.

Rules:
1. The concatenation of all "text" fields must reproduce the original text EXACTLY, character by character, with no additions or omissions.
2. Every character of the original text must appear in exactly one segment.
3. Most text should be "plain" — only annotate words or phrases that are educationally significant or contain errors.
4. Do NOT tag vocabulary words. Vocabulary highlights are added manually by the teacher, not by you. Use "grammar" only for function words/structures and "suggestion" only for errors.
5. For "grammar" segments: keep the span minimal (often a single function word) and explain the rule + how it applies here in "annotation".
6. For "suggestion" segments: provide the correction and a brief grammar explanation in "annotation".
7. Do not invent a "correct" type to praise good phrasing — leave correct text as "plain" (or "grammar" if it illustrates the practiced structure).

Return your response as a JSON object with a single key "segments" containing an array of segment objects.

Example 1 — direct object pronouns practiced correctly (tag the pronouns as grammar, leave the rest plain):
Input: "¿Dónde está Andrés? No lo veo."
Output:
{
  "segments": [
    {"text": "¿Dónde está Andrés? No ", "type": "plain"},
    {"text": "lo", "type": "grammar", "annotation": "Direct object pronoun, masculine singular — refers back to Andrés. lo = him."},
    {"text": " veo.", "type": "plain"}
  ]
}

Example 2 — wrong pronoun gender (suggestion):
Input: "¿Dónde está Andrés? No la veo."
Output:
{
  "segments": [
    {"text": "¿Dónde está Andrés? No ", "type": "plain"},
    {"text": "la", "type": "suggestion", "annotation": "Use lo, not la — Andrés is masculine singular, so the direct object pronoun is lo (him), matching gender."},
    {"text": " veo.", "type": "plain"}
  ]
}

Example 3 — wrong pronoun number (suggestion):
Input: "¿Dónde están las cucharas? No la veo."
Output:
{
  "segments": [
    {"text": "¿Dónde están las cucharas? No ", "type": "plain"},
    {"text": "la", "type": "suggestion", "annotation": "Use las — cucharas is feminine plural, so the direct object pronoun must be las (them), matching gender and number."},
    {"text": " veo.", "type": "plain"}
  ]
}

Example 4 — ser/estar accent (suggestion):
Input: "El gato esta en la mesa."
Output:
{
  "segments": [
    {"text": "El gato ", "type": "plain"},
    {"text": "esta", "type": "suggestion", "annotation": "Use está — the verb estar (to be, for location) takes an accent; 'esta' without the accent means 'this'."},
    {"text": " en la mesa.", "type": "plain"}
  ]
}

Example 5 — wrong tense (suggestion):
Input: "Ayer yo como pizza."
Output:
{
  "segments": [
    {"text": "Ayer yo ", "type": "plain"},
    {"text": "como", "type": "suggestion", "annotation": "Use comí — 'ayer' (yesterday) is a completed past action, so use the preterite comí, not the present como."},
    {"text": " pizza.", "type": "plain"}
  ]
}

If the assignment prompt is provided, use it as context for the analysis (e.g. focus on the grammar topic it mentions)."""


class AssignmentService:
    """Service for analyzing student drafts and returning annotated segments."""

    def __init__(self, session: Session, model: str = DEFAULT_MODEL):
        self.session = session
        self.model = model

    def analyze_draft(self, note_id: int, block_id: str) -> AnalyzeResponse:
        """
        Analyze a student draft block and return annotated segments.

        Finds the draft block, extracts its text content, calls OpenAI
        for structured analysis, saves an ai_feedback block, and returns
        the annotated segments.
        """
        note = self._get_note(note_id)
        history = note.history or {}
        content = history.get('content', [])

        # Find the target block
        target_block = self._find_block(content, block_id)
        if not target_block:
            raise HTTPException(status_code=404, detail="Note block not found")

        # Extract plain text from the block content
        draft_text = self._extract_text(target_block.get('content', ''))
        if not draft_text.strip():
            raise HTTPException(status_code=400, detail="Draft block has no text content")

        # Find assignment prompt for context
        assignment_prompt = self._find_assignment_prompt(content)

        # Build messages and call OpenAI for analysis
        messages = self._build_analysis_messages(draft_text, assignment_prompt)
        raw = self._call_openai(messages)
        segments = self._parse_segments(raw, draft_text)

        # Remove any existing ai_feedback block for this draft to avoid duplicates
        content = [b for b in content if not (
            b.get('block_type') == 'ai_feedback' and b.get('assignment_ref') == block_id
        )]

        # Create ai_feedback block
        feedback_block = NoteBlock(
            id=str(uuid.uuid4()),
            role="assistant",
            content=[seg.model_dump() for seg in segments],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            block_type="ai_feedback",
            assignment_ref=block_id,
        )

        # Save to note history
        # TODO bug ovveride history edited with Submit button
        content.append(feedback_block.model_dump(mode="json"))
        history['content'] = content
        self.session.exec(
            update(Note).where(Note.id == note_id).values(history=history)
        )
        self.session.commit()

        return AnalyzeResponse(
            status="ok",
            segments=segments,
            feedback_block=feedback_block.model_dump(mode="json"),
        )

    def _get_note(self, note_id: int) -> Note:
        note = self.session.get(Note, note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        return note

    def _find_block(self, content: list, block_id: str) -> Optional[dict]:
        for block in content:
            if block.get('id') == block_id:
                return block
        return None

    def _find_assignment_prompt(self, content: list) -> Optional[str]:
        for block in content:
            if block.get('block_type') == 'assignment':
                block_content = block.get('content', '')
                return self._extract_text(block_content)
        return None

    def _extract_text(self, content) -> str:
        """Flatten content to plain text, whether it's a string or list of segments."""
        if isinstance(content, list):
            return "".join(seg.get("text", "") for seg in content if isinstance(seg, dict))
        return str(content)

    def _build_analysis_messages(self, draft_text: str, assignment_prompt: Optional[str]) -> list:
        messages = [{"role": "developer", "content": ASSIGNMENT_ANALYSIS_PROMPT}]

        if assignment_prompt:
            messages.append({
                "role": "user",
                "content": f"Assignment prompt:\n{assignment_prompt}\n\nStudent draft:\n{draft_text}",
            })
        else:
            messages.append({
                "role": "user",
                "content": f"Analyze this student draft:\n{draft_text}",
            })

        return messages

    def _call_openai(self, messages: list) -> str:
        response = client.chat.completions.create(
            messages=messages,
            model=self.model,
            response_format={"type": "json_object"},
        )
        return response.choices[0].message.content

    def _parse_segments(self, response_text: str, original_text: str) -> List[DraftSegment]:
        """Parse OpenAI JSON response into DraftSegment objects.

        Handles responses wrapped in markdown code fences.
        Fallback to a single plain segment on parse failure.
        """
        # Strip markdown code fences if present (```json ... ``` or ``` ... ```)
        stripped = response_text.strip()
        if stripped.startswith('```'):
            first_newline = stripped.index('\n') if '\n' in stripped else len(stripped)
            stripped = stripped[first_newline + 1:]
            if stripped.rstrip().endswith('```'):
                stripped = stripped.rstrip()[:-3].rstrip()

        try:
            data = json.loads(stripped)
            if isinstance(data, dict) and 'segments' in data:
                segments_data = data['segments']
            elif isinstance(data, list):
                segments_data = data
            else:
                segments_data = None

            if segments_data and isinstance(segments_data, list):
                segments = []
                for seg in segments_data:
                    if isinstance(seg, dict) and 'text' in seg and 'type' in seg:
                        segments.append(DraftSegment(
                            text=seg['text'],
                            type=seg['type'],
                            word=seg.get('word') or None,
                            phonetic=seg.get('phonetic') or None,
                            annotation=seg.get('annotation') or None,
                        ))
                if segments:
                    return segments
        except (json.JSONDecodeError, KeyError, TypeError):
            pass

        # Fallback: return the entire text as a single plain segment
        return [DraftSegment(text=original_text, type="plain")]