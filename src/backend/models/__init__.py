# Import all models for easy access
from .chat import Chat, Message, ChatListResponse
from .sentence import ReverseIndex, Sentence
from .wordlist import (
    Wordlist, Dictionary, EnglishDialect, 
    EnglishTranslation, EnglishSense, EnglishPosGroup,
    EnglishWordDefinition, WordlistCreate, 
    WordlistUpdate, WordDefinitionResponse, WordlistResponse,
    TranslateTextRequest, Example, AudioInfo, EnglishWordEntry
)
from .dict_spanish import (
    SpanishWordEntry, SpanishWordDefinition, VerbConjugations,
    Participle, ConjugationForm, Example as SpanishExample,
    Translation, Sense, PosGroup, Pronunciation,
    SpanishWordRequest
)