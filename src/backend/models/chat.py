from sqlmodel import SQLModel, Field, Column, JSON, Relationship
from pydantic import BaseModel
from datetime import datetime
from typing import List

class Chat(SQLModel, table=True):
    """Model for chat sessions."""
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    history: dict = Field(default_factory=dict, sa_column=Column(JSON))
    images: List["ChatImage"] = Relationship(back_populates="chat")

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

class Message(BaseModel):
    """Schema for chat messages."""
    message: str
    is_note: bool = False
    image_ids: List[int] = []