from sqlmodel import SQLModel, Field, Column, JSON

class ReverseIndex(SQLModel, table=True):
    """Model for word-to-sentence reverse index."""
    __tablename__ = 'reverse_index'

    word: str = Field(primary_key=True)
    sentence_ids: list = Field(default_factory=list, sa_column=Column(JSON))

class Sentence(SQLModel, table=True):
    """Model for sentences in the corpus."""
    __tablename__ = 'sentences'

    id: int = Field(primary_key=True)
    sentence: str
    meta: list[dict] = Field(default_factory=list, sa_column=Column(JSON))