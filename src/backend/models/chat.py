from sqlmodel import SQLModel, Field, Column, JSON
from pydantic import BaseModel

class Chat(SQLModel, table=True):
    """Model for chat sessions."""
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    history: dict = Field(default_factory=dict, sa_column=Column(JSON))

class ChatListResponse(BaseModel):
    id: int 
    name: str


class Message(BaseModel):
    """Schema for chat messages."""
    message: str
    is_note: bool = False