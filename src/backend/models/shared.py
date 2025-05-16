from typing import Optional
from pydantic import BaseModel




# Common models for both languages

class Example(BaseModel):
    """Example of word usage."""
    source_text: str  # Spanish text for Spanish, English example for English
    target_text: str  # English translation for Spanish, additional context for English

class Definition(BaseModel):

    def get_examples(self)-> list[Example]:
        pass

class AudioInfo(BaseModel):
    """Audio information for a word."""
    text: str
    audio_url: Optional[str] = None
    lang: str  # 'es' for Spanish, 'en' for English


