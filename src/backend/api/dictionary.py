from fastapi import APIRouter, Depends, Query
from typing import Annotated, Dict
from sqlmodel import Session

from ..database import get_session
from ..services.unified_dictionary_service import get_word_definition
from ..services.sentence_service import search_for_sentences

# Create router
router = APIRouter(prefix="/api", tags=["dictionary"])

# Type alias for session dependency
SessionDep = Annotated[Session, Depends(get_session)]


@router.get('/words/{word}')
def get_word_definition_endpoint(
    word: str, 
    session: SessionDep,
    language: str = Query("en", description="Language code (en or es)"),
    include_conjugations: bool = Query(False, description="Include verb conjugations (Spanish only)")
):
    """
    Get the definition of a word in the specified language.
    
    Args:
        word: The word to look up
        language: Language code ('en' for English, 'es' for Spanish)
        include_conjugations: Whether to include verb conjugations (Spanish only)
        
    Returns:
        Dictionary with word definition
    """
    def_ =  get_word_definition([word], language, session, include_conjugations)
    return def_[0] if len(def_) > 0 else {}


@router.get('/coach/index/words/{word}')
def search_for_sentences_endpoint(session: SessionDep, word: str):
    """Search for sentences containing a specific word."""
    return search_for_sentences(session, word)