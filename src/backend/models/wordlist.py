from enum import Enum
from sqlmodel import SQLModel, Field, Column, JSON
from pydantic import BaseModel
from typing import List, Optional

class Wordlist(SQLModel, table=True):
    """Model for word lists."""
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field()
    words: list[str] = Field(default_factory=list, sa_column=Column(JSON))

class Dictionary(SQLModel, table=True):
    """Model for cached dictionary entries."""
    id: int | None = Field(default=None, primary_key=True)
    word: str
    word_meta: dict = Field(default_factory=dict, sa_column=Column(JSON))

# Pydantic schemas for API
class EnglishDialect(str, Enum):
    us = 'us'
    uk = 'uk'

class WordDefinitionDetail(BaseModel):
    definition: str
    synonyms: list[str] = []
    antonyms: list[str] = []
    example: str | None = None

class WordMeaning(BaseModel):
    part_of_speech: str
    definitions: list[WordDefinitionDetail]
    synonyms: list[str] = []
    antonyms: list[str] = []

class EnglishWordDefinition(BaseModel):
    audio_link: str | None = None
    english_dialect: EnglishDialect
    meanings: list[WordMeaning]

class WordlistCreate(BaseModel):
    name: str
    words: list[str]

class WordlistUpdate(BaseModel):
    name: str | None = None
    words: list[str] | None = None

class WordDefinitionResponse(BaseModel):
    word: str
    definition: EnglishWordDefinition

class WordlistResponse(BaseModel):
    id: int
    name: str
    words: list[WordDefinitionResponse]

class TranslateTextRequest(BaseModel):
    text: str
    target: str