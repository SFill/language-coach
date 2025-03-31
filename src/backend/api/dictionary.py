from fastapi import APIRouter, Depends
from typing import Annotated
from sqlmodel import Session

from ..database import get_session
from ..models.wordlist import EnglishWordDefinition
from ..services.dictionary_service import get_word_definition
from ..services.sentence_service import search_for_sentences

# Create router
router = APIRouter(prefix="/api", tags=["dictionary"])

# Type alias for session dependency
SessionDep = Annotated[Session, Depends(get_session)]


@router.get('/words/{word}', response_model=EnglishWordDefinition)
def get_word_definition_endpoint(word: str, session: SessionDep) -> EnglishWordDefinition:
    """Get the definition of a word."""
    return get_word_definition(word, session)


@router.get('/coach/index/words/{word}')
def search_for_sentences_endpoint(session: SessionDep, word: str):
    """Search for sentences containing a specific word."""
    return search_for_sentences(session, word)