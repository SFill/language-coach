from sqlmodel import SQLModel, Field, Column, JSON, Relationship
from pydantic import BaseModel, Field as PydanticField, computed_field
from datetime import datetime
from typing import List, Literal, Optional


class ChatMessage(BaseModel):
    """Schema representing a message stored in chat history."""
    id: int
    role: Literal["user", "assistant", "system", "developer"]
    content: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_note: bool = False
    image_ids: List[int] = PydanticField(default_factory=list)


class Chat(SQLModel, table=True):
    """Model for chat sessions."""
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    history: dict = Field(default_factory=lambda: {'content': []}, sa_column=Column(JSON))
    images: List["ChatImage"] = Relationship(back_populates="chat")
    max_message_id: int = Field(default=0)

    @computed_field
    @property
    def messages(self) -> list[ChatMessage]:
        return [ChatMessage.model_validate(msg) for msg in self.history['content']]
    
    def get_new_message_id(self):
        self.max_message_id+=1
        return self.max_message_id
    
    def model_dump(self, *args,**kwargs):
        kwargs['exclude'] = kwargs.get('exclude') or []
        kwargs['exclude'].append('history')
        return super().model_dump(*args,**kwargs)

class ChatImage(SQLModel, table=True):
    """Model for images attached to chats."""
    id: int | None = Field(default=None, primary_key=True)
    chat_id: int = Field(foreign_key="chat.id")
    filename: str = Field(index=True)
    original_filename: str
    file_path: str
    mime_type: str
    file_size: int
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    
    chat: Chat = Relationship(back_populates="images")

class ChatListResponse(BaseModel):
    id: int 
    name: str

class ChatImageResponse(BaseModel):
    """Response schema for chat images."""
    id: int
    filename: str
    original_filename: str
    mime_type: str
    file_size: int
    uploaded_at: datetime




class ChatMessageCreate(BaseModel):
    """Schema for creating chat messages."""
    message: str
    is_note: bool = False
    image_ids: List[int] = PydanticField(default_factory=list)


class ChatMessageUpdate(BaseModel):
    """Schema for updating existing chat messages."""
    message: Optional[str] = None