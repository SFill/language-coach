from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Annotated, List, Optional
from sqlmodel import Session, select

from ..database import get_session
from ..models.wordlist import (
    Wordlist, WordlistCreate, WordlistUpdate,
    WordlistResponse, WordDefinitionResponse, Language
)
from ..services.unified_dictionary_service import get_word_definition

# Create router
router = APIRouter(prefix="/api/wordlist", tags=["wordlist"])

# Type alias for session dependency
SessionDep = Annotated[Session, Depends(get_session)]


@router.get('/', response_model=list[WordlistResponse])
def list_wordlists_endpoint(
    session: SessionDep,
    language: str = Query("en", description="Language code (en or es)")
):
    """Get a list of all wordlists with definitions for the specified language."""
    # Filter wordlists by language
    wordlists = session.exec(
        select(Wordlist).where(Wordlist.language == language)
    ).all()

    results = []
    for wl in wordlists:
        definitions = []
        for word in wl.words:
            word_def = get_word_definition(word, language, session)
            definitions.append(WordDefinitionResponse(word=word, definition=word_def))
        results.append(WordlistResponse(
            id=wl.id,
            name=wl.name,
            language=wl.language,
            words=definitions
        ))
    return results


@router.post('/', response_model=WordlistResponse)
def create_wordlist_endpoint(
    wordlist: WordlistCreate,
    session: SessionDep,
    language: str = Query("en", description="Language code (en or es)")
):
    """Create a new wordlist."""
    # Use the language from the request body if provided, otherwise use the query parameter
    list_language = wordlist.language or language

    # Validate language
    if list_language not in [e.value for e in Language]:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {list_language}")

    new_wordlist = Wordlist(
        name=wordlist.name,
        words=wordlist.words,
        language=list_language
    )
    session.add(new_wordlist)
    session.commit()
    session.refresh(new_wordlist)

    definitions = []
    for word in new_wordlist.words:
        word_def = get_word_definition(word, list_language, session)
        definitions.append(WordDefinitionResponse(word=word, definition=word_def))

    return WordlistResponse(
        id=new_wordlist.id,
        name=new_wordlist.name,
        language=new_wordlist.language,
        words=definitions
    )


@router.get('/{pk}', response_model=WordlistResponse)
def get_wordlist_endpoint(
    pk: int,
    session: SessionDep,
    language: str = Query(None, description="Language override (en or es)"),
    include_conjugations: bool = Query(False, description="Include verb conjugations (Spanish only)")
):
    """Get a specific wordlist by ID."""
    wl = session.get(Wordlist, pk)
    if not wl:
        raise HTTPException(status_code=404, detail="Wordlist not found")

    # Use provided language override or the wordlist's language
    lookup_language = language or wl.language

    definitions = []
    for word in wl.words:
        word_def = get_word_definition(word, lookup_language, session, include_conjugations)
        definitions.append(WordDefinitionResponse(word=word, definition=word_def))

    return WordlistResponse(
        id=wl.id,
        name=wl.name,
        language=wl.language,
        words=definitions
    )


# we use sendBeacon method when page unloads to sync changes, but it only supports POST.
#  https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon
@router.post('/{pk}', response_model=WordlistResponse)
def update_wordlist_endpoint(
    pk: int,
    wordlist: WordlistUpdate,
    session: SessionDep,
    language: str = Query(None, description="Language override (en or es)"),
    include_conjugations: bool = Query(False, description="Include verb conjugations (Spanish only)")
):
    """Update a wordlist."""
    wl = session.get(Wordlist, pk)
    if not wl:
        raise HTTPException(status_code=404, detail="Wordlist not found")

    if wordlist.name is not None:
        wl.name = wordlist.name
    if wordlist.words is not None:
        wl.words = wordlist.words
    if wordlist.language is not None:
        # Validate language if it's being updated
        if wordlist.language not in [e.value for e in Language]:
            raise HTTPException(status_code=400, detail=f"Unsupported language: {wordlist.language}")
        wl.language = wordlist.language

    session.add(wl)
    session.commit()
    session.refresh(wl)

    # Use provided language override or the wordlist's language for definitions
    lookup_language = language or wl.language

    definitions = []
    for word in wl.words:
        word_def = get_word_definition(word, lookup_language, session, include_conjugations)
        definitions.append(WordDefinitionResponse(word=word, definition=word_def))

    return WordlistResponse(
        id=wl.id,
        name=wl.name,
        language=wl.language,
        words=definitions
    )


@router.delete('/{pk}')
def delete_wordlist_endpoint(pk: int, session: SessionDep):
    """Delete a wordlist."""
    wl = session.get(Wordlist, pk)
    if not wl:
        raise HTTPException(status_code=404, detail="Wordlist not found")

    session.delete(wl)
    session.commit()
    return {"detail": "Wordlist deleted"}
