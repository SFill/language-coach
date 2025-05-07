from enum import Enum
from sqlmodel import SQLModel, Field, Column, JSON
from pydantic import BaseModel
from typing import List, Optional, Dict


class Language(str, Enum):
    """Enum for supported languages"""
    english = 'en'
    spanish = 'es'


class Wordlist(SQLModel, table=True):
    """Model for word lists."""
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field()
    words: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    language: str = Field(default="en")  # Default to English if not specified


class Dictionary(SQLModel, table=True):
    """Model for cached dictionary entries."""
    id: int | None = Field(default=None, primary_key=True)
    word: str
    word_meta: dict = Field(default_factory=dict, sa_column=Column(JSON))

# Common models for both languages


class Example(BaseModel):
    """Example of word usage."""
    source_text: str  # Spanish text for Spanish, English example for English
    target_text: str  # English translation for Spanish, additional context for English


class AudioInfo(BaseModel):
    """Audio information for a word."""
    text: str
    audio_url: Optional[str] = None
    lang: str  # 'es' for Spanish, 'en' for English

# English dictionary specific models


class EnglishDialect(str, Enum):
    us = 'us'
    uk = 'uk'


class EnglishTranslation(BaseModel):
    """Translation information for an English word."""
    translation: str = ""  # Definition in English, is not provided
    examples: List[Example] = []


class EnglishSense(BaseModel):
    """Sense information for an English word."""
    context_en: str = ""  # Context or usage note
    translations: List[EnglishTranslation] = []
    synonyms: List[str] = []
    antonyms: List[str] = []


class EnglishPosGroup(BaseModel):
    """Group of senses by part of speech for an English word."""
    pos: str  # Name of the part of speech
    senses: List[EnglishSense] = []


class EnglishWordEntry(BaseModel):
    """Entry for an English word."""
    word: str
    pos_groups: List[EnglishPosGroup] = []


class EnglishWordDefinition(BaseModel):
    """Definition structure for an English word."""
    word: str
    entries: List[EnglishWordEntry] = []
    audio: Optional[AudioInfo] = None
    dialect: Optional[EnglishDialect] = EnglishDialect.us

    @classmethod
    def init_empty(cls, word):
        return EnglishWordDefinition(
            word=word,
            entries=[],
            audio=None,
            dialect=EnglishDialect.us
        )


class WordlistResponse(BaseModel):
    """Response model for wordlists."""
    id: int
    name: str
    language: str = "en"  # Include language in response
    words: List[Dict]


class WordlistCreate(BaseModel):
    """Model for creating a new wordlist."""
    name: str
    words: List[str]
    language: Optional[str] = "en"  # Make language optional with default


class WordlistUpdate(BaseModel):
    """Model for updating a wordlist."""
    name: Optional[str] = None
    words: Optional[List[str]] = None
    language: Optional[str] = None  # Allow updating the language


class TranslateTextRequest(BaseModel):
    """Request model for text translation."""
    text: str
    target: str
