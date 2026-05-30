from sqlmodel import SQLModel, Field, Column, JSON, Relationship
from pydantic import BaseModel, Field as PydanticField, computed_field
from datetime import datetime
from typing import List, Literal, Optional, Union
import re


class NoteBlock(BaseModel):
    """Schema representing a message stored in note history."""
    id: str  # UUID
    role: Literal["user", "assistant", "system", "developer"]
    content: Union[str, List[dict]]  # str for plain text, List[dict] for annotated segments
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    block_type: Optional[str] = None  # "simple_note", "assignment", "question", "ai_feedback"
    metadata_: Optional[dict] = None  # category, difficulty, targetLength, etc.
    assignment_ref: Optional[str] = None  # UUID of the assignment block this block belongs to
    question_title: Optional[str] = None  # Rephrased question title for Q&A blocks

    @computed_field
    @property
    def image_ids(self) -> List[int]:
        """Parse image IDs from content dynamically - no storage needed."""
        if isinstance(self.content, list):
            return []
        return [int(img_id) for img_id in re.findall(r'@image:(\d+)', self.content)]


class Note(SQLModel, table=True):
    """Model for note sessions."""
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    metadata_: Optional[dict] = Field(default=None, sa_column=Column("metadata", JSON))
    history: dict = Field(default_factory=lambda: {'content': []}, sa_column=Column(JSON))
    images: List["NoteImage"] = Relationship(back_populates="note")

    @computed_field
    @property
    def note_blocks(self) -> list[NoteBlock]:
        return [NoteBlock.model_validate(msg) for msg in self.history['content']]

    @computed_field
    @property
    def note_metadata(self) -> dict:
        return self.metadata_ or {}

    def model_dump(self, *args, **kwargs):
        kwargs['exclude'] = kwargs.get('exclude') or []
        if 'history' not in kwargs['exclude']:
            kwargs['exclude'].append('history')
        if 'metadata_' not in kwargs['exclude']:
            kwargs['exclude'].append('metadata_')
        return super().model_dump(*args, **kwargs)


class NoteImage(SQLModel, table=True):
    """Model for images attached to notes."""
    id: int | None = Field(default=None, primary_key=True)
    note_id: int = Field(foreign_key="note.id")
    filename: str = Field(index=True)
    original_filename: str
    file_path: str
    mime_type: str
    file_size: int
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

    note: Note = Relationship(back_populates="images")


class NoteListResponse(BaseModel):
    id: int
    name: str
    note_metadata: Optional[dict] = None
    note_blocks: list[NoteBlock] = []


class NoteImageResponse(BaseModel):
    """Response schema for note images."""
    id: int
    filename: str
    original_filename: str
    mime_type: str
    file_size: int
    uploaded_at: datetime


class NoteCreate(BaseModel):
    """Schema for creating a note."""
    name: str
    note_metadata: Optional[dict] = None
    history: dict = PydanticField(default_factory=lambda: {'content': []})


class NoteBlockCreate(BaseModel):
    """Schema for creating note messages."""
    id: Optional[str] = None  # Client-generated UUID, auto-generated if not provided
    block: str
    block_type: Optional[str] = None  # "simple_note", "assignment", "question", "ai_feedback"
    metadata_: Optional[dict] = None  # category, difficulty, targetLength, etc.
    assignment_ref: Optional[str] = None  # UUID of the assignment block this draft belongs to
    image_ids: List[int] = PydanticField(default_factory=list)
    question_title: Optional[str] = None


class NoteBlockUpdate(BaseModel):
    """Schema for updating or creating note messages (idempotent upsert)."""
    block: Optional[str] = None
    role: Optional[str] = None
    block_type: Optional[str] = None
    metadata_: Optional[dict] = None
    assignment_ref: Optional[str] = None


class QuestionCreate(BaseModel):
    """Schema for creating a question about a note."""
    question: str
    assignment_ref: Optional[str] = None  # UUID of the assignment block
    question_type: Optional[str] = None  # "grammar_check", "vocabulary", "style"


class DraftSegment(BaseModel):
    """A single segment in an annotated draft."""
    text: str
    type: str  # "plain", "vocab", "correct", "suggestion"
    word: Optional[str] = None
    phonetic: Optional[str] = None
    annotation: Optional[str] = None


class AnalyzeResponse(BaseModel):
    """Response schema for draft analysis."""
    status: str
    segments: List[DraftSegment]
    feedback_block: dict