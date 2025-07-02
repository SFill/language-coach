from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship


class Text(SQLModel, table=True):
    """Model for Gutenberg text entries."""
    __tablename__ = "reverse_index_texts"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    language: str
    category: str
    source: str  # Reference to Gutenberg ID
    
    # We'll use back_populates but not relationship to avoid circular dependency
    # phrases: List["Phrase"] = Relationship(back_populates="text")


class Phrase(SQLModel, table=True):
    """Model for phrases (sentences) from texts."""
    __tablename__ = "reverse_index_phrases"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    text: str
    language: str  # Added for query optimization
    text_id: int = Field(foreign_key="texts.id")
    
    # Remove relationship to fix circular dependency issue
    # text: Text = Relationship(back_populates="phrases")
    # words: List["Word"] = Relationship(back_populates="phrase")


class Word(SQLModel, table=True):
    """Model for words with POS tagging."""
    __tablename__ = "reverse_index_words"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    text: str
    lemma: str
    pos: str
    tag: str
    is_stop: bool = False
    is_punct: bool = False
    ent_type: str = ""
    phrase_id: int = Field(foreign_key="phrases.id")
    text_id: int = Field(foreign_key="texts.id")
    
    # Remove relationships to simplify
    # phrase: Phrase = Relationship(back_populates="words")
    # text: Text = Relationship()