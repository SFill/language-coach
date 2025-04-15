from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from ..models.wordlist import Example, AudioInfo


class Translation(BaseModel):
    """Translation information for a Spanish word."""
    translation: str
    examples: List[Example] = []
    context: str = ""


class Sense(BaseModel):
    """Sense information for a Spanish word."""
    context_en: str
    context_es: str
    gender: Optional[str] = None
    translations: List[Translation] = []
    # TODO reserved fields, always empty, add support
    synonyms: List[str] = []
    antonyms: List[str] = []


class PosGroup(BaseModel):
    """Group of senses by part of speech for a Spanish word."""
    pos: str  # Name of the part of speech
    senses: List[Sense] = []


class SpanishWordEntry(BaseModel):
    """Entry for a Spanish word."""
    word: str
    pos_groups: List[PosGroup] = []


# Pronunciation models
class Pronunciation(BaseModel):
    """Pronunciation information for a word."""
    id: Optional[int] = None
    ipa: Optional[str] = None  # International Phonetic Alphabet
    region: Optional[str] = None  # LATAM, SPAIN, etc.
    has_video: Optional[bool] = None


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
    """Definition for a Spanish word."""
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
