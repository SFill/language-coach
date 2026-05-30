"""Question service for processing questions about notes."""

import uuid
from typing import Optional, List, Tuple
from datetime import datetime
from sqlmodel import Session, update
from fastapi import HTTPException

from backend.models.note import Note, NoteBlock, QuestionCreate
from backend.constants import SYSTEM_PROMPT
from backend.services.question.image_processor import ImageProcessor
from backend.services.question.openai_provider import OpenAIProvider
from backend.services.openai_client import DEFAULT_MODEL


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
        
        # 2. Process images in question
        processed_content = self.image_processor.process_images(
            question_data.question, 
            note_id
        )
        
        # 3. Get assignment context if specified
        parent_context = ""
        if question_data.assignment_ref:
            parent_block = self._get_note_block(note, question_data.assignment_ref)
            if parent_block:
                parent_context = f"\n\n---\nNote Context:\n{parent_block.get('content', '')}\n---\n"
        
        # 4. Build prompt messages
        messages = self._build_prompt_messages(
            note_history=note.history,
            question=processed_content.text,
            parent_context=parent_context,
            image_contents=processed_content.image_contents
        )
        
        # 5. Generate AI response
        ai_response = self.ai_provider.generate_response(messages)
        
        # 6. Parse response into title and answer
        title, answer = self._parse_qa_response(ai_response)
        
        # 7. Create and save Q&A block
        qa_block = self._create_qa_block(
            note=note,
            title=title,
            answer=answer,
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
    
    def _build_prompt_messages(
        self,
        note_history: dict,
        question: str,
        parent_context: str,
        image_contents: List[dict]
    ) -> List[dict]:
        """Build complete message list for OpenAI API."""
        messages = []
        
        # Add system prompt
        messages.append({
            "role": "developer",
            "content": SYSTEM_PROMPT
        })
        
        # Add note history (only simple_note blocks, not questions or assignments)
        content = note_history.get('content', [])
        for hist_msg in content:
            block_type = hist_msg.get("block_type")
            # Include simple_note blocks and ai_feedback in context
            if block_type in ("simple_note", "ai_feedback") or (block_type is None and hist_msg.get("role") == "user"):
                msg_content = hist_msg.get("content")
                # Flatten segmented content to plain text for OpenAI
                if isinstance(msg_content, list):
                    msg_content = "".join(seg.get("text", "") for seg in msg_content)
                messages.append({
                    "role": hist_msg.get("role"),
                    "content": msg_content
                })
        
        # Add current question with context
        question_with_context = f"{question}{parent_context}"
        if image_contents:
            user_content = [{"type": "text", "text": question_with_context}] + image_contents
        else:
            user_content = question_with_context
        
        messages.append({
            "role": "user",
            "content": user_content
        })
        
        # Add formatting instruction
        messages.append({
            "role": "developer",
            "content": """Please respond in the following format:
        
First line: A clear, rephrased version of the question for better readability (this will be used as a title)

Then provide your detailed answer below."""
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
        assignment_ref: Optional[str]
    ) -> NoteBlock:
        """Create a Q&A note block from parsed content."""
        timestamp = datetime.utcnow()
        return NoteBlock(
            id=str(uuid.uuid4()),
            role="assistant",
            content=answer,
            question_title=title,
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
