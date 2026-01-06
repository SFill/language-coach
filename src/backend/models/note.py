from sqlmodel import SQLModel, Field, Column, JSON, Relationship
from pydantic import BaseModel, Field as PydanticField, computed_field
from datetime import datetime
from typing import List, Literal, Optional, Union
import re


class NoteBlock(BaseModel):
    """Schema representing a message stored in note history."""
    id: int
    role: Literal["user", "assistant", "system", "developer"]
    content: str  # Always string for backward compatibility
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_note: bool = False
    parent_note_block_id: Optional[int] = None  # Links questions to parent note
    block_type: Optional[str] = None  # "note", "question", "qa_response"
    question_title: Optional[str] = None  # Rephrased question title for Q&A blocks
    
    @computed_field
    @property
    def image_ids(self) -> List[int]:
        """Parse image IDs from content dynamically - no storage needed."""
        return [int(img_id) for img_id in re.findall(r'@image:(\d+)', self.content)]


class Note(SQLModel, table=True):
    """Model for note sessions."""
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    history: dict = Field(default_factory=lambda: {'content': []}, sa_column=Column(JSON))
    images: List["NoteImage"] = Relationship(back_populates="note")
    max_message_id: int = Field(default=0)

    @computed_field
    @property
    def note_blocks(self) -> list[NoteBlock]:
        return [NoteBlock.model_validate(msg) for msg in self.history['content']]
    
    def get_new_note_block_id(self):
        self.max_message_id+=1
        return self.max_message_id
    
    def model_dump(self, *args,**kwargs):
        kwargs['exclude'] = kwargs.get('exclude') or []
        kwargs['exclude'].append('history')
        return super().model_dump(*args,**kwargs)

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

class NoteImageResponse(BaseModel):
    """Response schema for note images."""
    id: int
    filename: str
    original_filename: str
    mime_type: str
    file_size: int
    uploaded_at: datetime




class NoteBlockCreate(BaseModel):
    """Schema for creating note messages."""
    block: str
    is_note: bool = False
    image_ids: List[int] = PydanticField(default_factory=list)


class NoteBlockUpdate(BaseModel):
    """Schema for updating existing note messages."""
    block: Optional[str] = None


class QuestionCreate(BaseModel):
    """Schema for creating a question about a note."""
    question: str
    parent_note_block_id: Optional[int] = None