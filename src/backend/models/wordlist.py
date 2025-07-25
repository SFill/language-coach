from enum import Enum
from sqlmodel import SQLModel, Field, Column, JSON
from pydantic import BaseModel, SerializeAsAny
from typing import List, Optional
from .shared import Definition

class Language(str, Enum):
    """Enum for supported languages"""
    english = 'en'
    spanish = 'es'


class WordInList(BaseModel):
    """Model for individual words in a wordlist."""
    word: str
    word_translation: Optional[str] = None
    example_phrase: Optional[str] = None
    example_phrase_translation: Optional[str] = None


class Wordlist(SQLModel, table=True):
    """Model for word lists."""
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field()
    words: list[WordInList] = Field(default_factory=list, sa_column=Column(JSON))
    language: str = Field(default="en")  # Default to English if not specified




class WordlistResponse(BaseModel):
    """Response model for wordlists."""
    id: int
    name: str
    language: str = "en"  # Include language in response
    words: List[WordInList]


class WordlistCreate(BaseModel):
    """Model for creating a new wordlist."""
    name: str
    words: List[WordInList]
    language: Optional[str] = "en"  # Make language optional with default


class WordlistUpdate(BaseModel):
    """Model for updating a wordlist."""
    name: str
    words: List[WordInList]
    language: str  # Allow updating the language


class TranslateTextRequest(BaseModel):
    """Request model for text translation."""
    text: str
    target: str
