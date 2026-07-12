"""Question service for processing questions about notes."""

import uuid
from typing import Optional, List, Tuple
from datetime import datetime
from sqlmodel import Session, update
from fastapi import HTTPException

from backend.models.note import Note, NoteBlock, QuestionCreate
from backend.services.question.image_processor import ImageProcessor
from backend.services.question.openai_provider import OpenAIProvider
from backend.services.openai_client import DEFAULT_MODEL

# Brevity cap for Q&A answers — keeps responses focused on the single question
# and prevents the "general review of the whole assignment" rambling.
QA_MAX_TOKENS = 600

# Dedicated Q&A system prompt. Deliberately separate from the shared SYSTEM_PROMPT
# (used by the general note-chat flow) which asks for long, headed markdown notes.
QA_SYSTEM_PROMPT = """You are a Spanish language tutor answering a student's question inside a homework assignment.

Answer ONLY the user's specific question. Do not review, summarize, or analyze the whole assignment.

Rules:
- Start with the answer directly. No preamble like "It looks like...", "Since you...", "I organized...", or "You have been practicing...".
- Be concise. Aim for a few short lines, not a long report.
- Answer the language of the question (Russian, English, Spanish) as appropriate.
- Use markdown sparingly: short bullet points, bold for a key rule, `inline code` for a short Spanish phrase. No section headings unless the question clearly asks for a structured breakdown.
- Do not use LaTeX or math notation. The output is rendered as plain markdown, so `$...$`, `\\rightarrow`, `\\times`, and similar syntax show up as literal text. Use plain unicode instead: `→` `←` `↔` `×` `÷`, etc.

Structure the body (only the parts that are relevant to this question):
1. Direct answer.
2. Short explanation (only if it adds value).
3. An example or corrected version (if the question is about a word, grammar, or a mistake).
4. A reference to the assignment/materials ONLY if it genuinely helps answer this question.

The assignment text, the student's draft, and any previous Q&A are provided as supporting context ONLY. They are never a reason to give a general review unless the user explicitly asked for one.

The FIRST line of your response must be a short rephrased version of the question (used as a title). The answer follows on the next lines."""


class QuestionService:
    """
    Service for processing questions about notes.
    Handles the complete question-answer flow.
    """

    def __init__(self, session: Session, model: str = DEFAULT_MODEL):
        """
        Initialize question service.

        Args:
            session: SQLModel database session
            model: OpenAI model to use (default: gpt-4o-mini)
        """
        self.session = session
        self.ai_provider = OpenAIProvider(model=model)
        self.image_processor = ImageProcessor(session)

    def process_question(self, note_id: int, question_data: QuestionCreate) -> dict:
        """
        Process a question and return a structured Q&A response.
        Main orchestration method.

        Args:
            note_id: ID of the note to ask about
            question_data: Question data including question text and parent block ID

        Returns:
            Dict with status and qa_block
        """
        # 1. Get and validate note
        note = self._get_note(note_id)

        # 2. Process images in question (for the model only — the stored original
        # question keeps the raw @image:N references intact).
        processed_content = self.image_processor.process_images(
            question_data.question,
            note_id
        )

        # 3. Build the minimal, labeled supporting context (assignment + draft +
        # previous Q&A), then the prompt messages.
        context_text = self._build_context(note, question_data.assignment_ref, question_data.prior_qa_id)
        messages = self._build_prompt_messages(
            context=context_text,
            question=processed_content.text,
            image_contents=processed_content.image_contents
        )

        # 4. Generate AI response (brevity-capped)
        ai_response = self.ai_provider.generate_response(messages, max_tokens=QA_MAX_TOKENS)

        # 5. Parse response into title and answer
        title, answer = self._parse_qa_response(ai_response)

        # 6. Create and save Q&A block (stores the original user question verbatim)
        qa_block = self._create_qa_block(
            note=note,
            title=title,
            answer=answer,
            question=question_data.question,
            assignment_ref=question_data.assignment_ref
        )

        self._save_note_block(note_id, note, qa_block)

        return {
            'status': 'ok',
            'qa_block': qa_block.model_dump(mode="json")
        }

    # Private helper methods

    def _get_note(self, note_id: int) -> Note:
        """Get note by ID or raise 404."""
        note = self.session.get(Note, note_id)
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        return note

    def _get_note_block(self, note: Note, block_id: str) -> Optional[dict]:
        """Get specific note block from note history."""
        history = note.history or {}
        content = history.get('content', [])

        for block in content:
            if block.get('id') == block_id:
                return block
        return None

    @staticmethod
    def _flatten_content(content) -> str:
        """Flatten segmented content (list of {text}) to plain text."""
        if isinstance(content, list):
            return "".join(seg.get("text", "") for seg in content)
        return content or ""

    def _build_context(self, note: Note, assignment_ref: Optional[str], prior_qa_id: Optional[str]) -> str:
        """
        Assemble the minimal labeled context for the question: the assignment,
        the student's draft for that assignment, and a specific previous Q&A pair
        (as a follow-up reference) when the user references one. Everything is
        optional and labeled so the model treats it as support, not as the
        subject to review.
        """
        history = note.history or {}
        content = history.get('content', [])

        parts: List[str] = []

        assignment_block = None
        if assignment_ref:
            assignment_block = self._get_note_block(note, assignment_ref)
        if assignment_block:
            parts.append(
                f"Assignment:\n{self._flatten_content(assignment_block.get('content'))}"
            )

        if assignment_ref:
            draft = next(
                (
                    b for b in content
                    if b.get("block_type") == "simple_note"
                    and b.get("role") == "user"
                    and b.get("assignment_ref") == assignment_ref
                ),
                None,
            )
            if draft:
                parts.append(
                    f"Student draft:\n{self._flatten_content(draft.get('content'))}"
                )

        # The specific prior Q&A the user referenced (e.g. "edit and ask again"
        # on a Q&A item). No fallback to the most recent — only the one picked.
        if prior_qa_id:
            prior_qa = self._get_note_block(note, prior_qa_id)
            if prior_qa and prior_qa.get("block_type") == "question":
                prev_question = prior_qa.get("question") or prior_qa.get("question_title") or ""
                prev_answer = self._flatten_content(prior_qa.get("content"))
                parts.append(
                    "Previous Q&A (reference only — use only if this is a follow-up):\n"
                    f"Q: {prev_question}\nA: {prev_answer}"
                )

        return "\n\n".join(parts)

    def _build_prompt_messages(
        self,
        context: str,
        question: str,
        image_contents: List[dict]
    ) -> List[dict]:
        """Build complete message list for OpenAI API."""
        messages = []

        # System prompt — focused, concise Q&A.
        messages.append({
            "role": "developer",
            "content": QA_SYSTEM_PROMPT
        })

        # Labeled supporting context (assignment + draft + previous Q&A), if any.
        if context.strip():
            messages.append({
                "role": "developer",
                "content": f"Supporting context:\n{context}"
            })

        # The current question is the primary request.
        if image_contents:
            user_content = [{"type": "text", "text": question}] + image_contents
        else:
            user_content = question

        messages.append({
            "role": "user",
            "content": user_content
        })

        return messages

    def _parse_qa_response(self, response: str) -> Tuple[str, str]:
        """
        Parse AI response into title and answer.

        Args:
            response: Raw AI response text

        Returns:
            Tuple of (title, answer)
        """
        lines = response.strip().split('\n', 1)
        title = lines[0].strip()
        answer = lines[1].strip() if len(lines) > 1 else ""
        return title, answer

    def _create_qa_block(
        self,
        note: Note,
        title: str,
        answer: str,
        question: str,
        assignment_ref: Optional[str]
    ) -> NoteBlock:
        """Create a Q&A note block from parsed content."""
        timestamp = datetime.utcnow()
        return NoteBlock(
            id=str(uuid.uuid4()),
            role="assistant",
            content=answer,
            question_title=title,
            question=question,
            created_at=timestamp,
            updated_at=timestamp,
            assignment_ref=assignment_ref,
            block_type="question"
        )

    def _save_note_block(self, note_id: int, note: Note, note_block: NoteBlock) -> None:
        """Save note block to note history."""
        history = note.history or {}
        content = history.get('content', [])

        content.append(note_block.model_dump(mode="json"))
        history['content'] = content

        self.session.exec(
            update(Note)
            .where(Note.id == note_id)
            .values(history=history)
        )
        self.session.commit()