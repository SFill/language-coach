# Import all models for easy access
from .dict_english import Dictionary, EnglishDialect
from .chat import Chat, Message, ChatListResponse
from .wordlist import (
    Wordlist, WordlistCreate, 
    WordlistUpdate, WordlistResponse,
    TranslateTextRequest, 
)

from .dict_english import *

from .shared import Example, AudioInfo

from .dict_spanish import (
    SpanishWordEntry, SpanishWordDefinition, VerbConjugations,
    Participle, ConjugationForm, Example as SpanishExample,
    Translation, Sense, PosGroup,
    SpanishWordRequest
)