from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any


class Example(BaseModel):
    """Example of word usage."""
    spanish: str
    english: str


class Translation(BaseModel):
    """Simplified translation information."""
    translation: str
    examples: List[Example] = []
    context: str = ""


class Sense(BaseModel):
    """Simplified sense information for a word."""
    context_en: str
    context_es: str
    gender: Optional[str] = None
    translations: List[Translation] = []


class PosGroup(BaseModel):
    """Simplified group of senses by part of speech."""
    pos: str  # Just the name of the part of speech
    senses: List[Sense] = []


class SpanishWordEntry(BaseModel):
    """Simplified entry for a Spanish word."""
    word: str
    pos_groups: List[PosGroup] = []


# Pronunciation models
class Pronunciation(BaseModel):
    """Pronunciation information for a word."""
    id: Optional[int] = None
    ipa: Optional[str] = None  # International Phonetic Alphabet
    region: Optional[str] = None  # LATAM, SPAIN, etc.
    has_video: Optional[bool] = None


class AudioInfo(BaseModel):
    """Audio information for a word."""
    text: str
    audio_url: Optional[str] = None
    pronunciations: List[Pronunciation] = []
    lang: str  # 'es' for Spanish, 'en' for English


# Conjugation models
class ConjugationForm(BaseModel):
    """A conjugation form for a specific pronoun."""
    forms: List[str]
    translation: str


class TenseConjugations(BaseModel):
    """Conjugations for a specific tense."""
    conjugations: Dict[str, ConjugationForm]  # pronoun -> conjugation


class Participle(BaseModel):
    """Participle form of a verb."""
    spanish: str
    english: str


class VerbConjugations(BaseModel):
    """Complete conjugation information for a verb."""
    infinitive: str
    translation: str
    is_reflexive: bool
    past_participle: Optional[Participle] = None
    gerund: Optional[Participle] = None
    tenses: Dict[str, Dict[str, ConjugationForm]] = {}
    examples: List[Example] = []


# Combined word definition model
class SpanishWordDefinition(BaseModel):
    """Simplified definition for a Spanish word."""
    word: str
    entries: List[SpanishWordEntry]
    conjugations: Optional[VerbConjugations] = None
    spanish_audio: Optional[AudioInfo] = None
    english_audio: Optional[AudioInfo] = None


# API request/response models
class SpanishWordRequest(BaseModel):
    """Request for Spanish word information."""
    word: str
    include_conjugations: bool = False


class SpanishWordResponse(BaseModel):
    """Response with Spanish word information."""
    word: str
    definition: SpanishWordDefinition