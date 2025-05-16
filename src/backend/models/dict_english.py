from enum import Enum
from sqlmodel import JSON, Column, Field, SQLModel
from pydantic import BaseModel

from typing import Optional

from .shared import Example, Definition, AudioInfo

# English dictionary specific models

class Dictionary(SQLModel, table=True):
    """Model for cached dictionary entries."""
    id: int | None = Field(default=None, primary_key=True)
    word: str
    word_meta: dict = Field(default_factory=dict, sa_column=Column(JSON))


class EnglishDialect(str, Enum):
    us = 'us'
    uk = 'uk'





class EnglishTranslation(BaseModel):
    """Translation information for an English word."""
    translation: str = ""  # Definition in English, is not provided
    examples: list[Example] = []


class EnglishSense(BaseModel):
    """Sense information for an English word."""
    context_en: str = ""  # Context or usage note
    translations: list[EnglishTranslation] = []
    synonyms: list[str] = []
    antonyms: list[str] = []


class EnglishPosGroup(BaseModel):
    """Group of senses by part of speech for an English word."""
    pos: str  # Name of the part of speech
    senses: list[EnglishSense] = []


class EnglishWordEntry(BaseModel):
    """Entry for an English word."""
    word: str
    pos_groups: list[EnglishPosGroup] = []


class EnglishWordDefinition(Definition):
    """Definition structure for an English word."""
    word: str
    entries: list[EnglishWordEntry] = []
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

    def get_examples(self):
        examples = []
        for entry in self.entries:
            for g in entry.pos_groups:
                for s in g.senses:
                    for t in s.translations:
                        for e in t.examples:
                            examples.append(e)
        return examples
