from fastapi import APIRouter, Depends, HTTPException
from typing import Annotated, List
from sqlmodel import Session, select

from ..database import get_session
from ..models.wordlist import (
    Wordlist, WordlistCreate, WordlistUpdate,
    WordlistResponse, WordDefinitionResponse
)
from ..services.dictionary_service import get_word_definition

# Create router
router = APIRouter(prefix="/api/wordlist", tags=["wordlist"])

# Type alias for session dependency
SessionDep = Annotated[Session, Depends(get_session)]


@router.get('/', response_model=list[WordlistResponse])
def list_wordlists_endpoint(session: SessionDep):
    """Get a list of all wordlists with definitions."""
    wordlists = session.exec(select(Wordlist)).all()
    results = []
    for wl in wordlists:
        definitions = []
        for word in wl.words:
            eng_def = get_word_definition(word, session)
            definitions.append(WordDefinitionResponse(word=word, definition=eng_def))
        results.append(WordlistResponse(id=wl.id, name=wl.name, words=definitions))
    return results


@router.post('/', response_model=WordlistResponse)
def create_wordlist_endpoint(wordlist: WordlistCreate, session: SessionDep):
    """Create a new wordlist."""
    new_wordlist = Wordlist(name=wordlist.name, words=wordlist.words)
    session.add(new_wordlist)
    session.commit()
    session.refresh(new_wordlist)

    definitions = []
    for word in new_wordlist.words:
        eng_def = get_word_definition(word, session)
        definitions.append(WordDefinitionResponse(word=word, definition=eng_def))
    return WordlistResponse(id=new_wordlist.id, name=new_wordlist.name, words=definitions)


@router.get('/{pk}', response_model=WordlistResponse)
def get_wordlist_endpoint(pk: int, session: SessionDep):
    """Get a specific wordlist by ID."""
    wl = session.get(Wordlist, pk)
    if not wl:
        raise HTTPException(status_code=404, detail="Wordlist not found")

    definitions = []
    for word in wl.words:
        eng_def = get_word_definition(word, session)
        definitions.append(WordDefinitionResponse(word=word, definition=eng_def))
    return WordlistResponse(id=wl.id, name=wl.name, words=definitions)

# we use sendBeacon method when page unloads to sync changes, but it only supports POST.
#  https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon
@router.post('/{pk}', response_model=WordlistResponse)
def update_wordlist_endpoint(pk: int, wordlist: WordlistUpdate, session: SessionDep):
    """Update a wordlist."""
    wl = session.get(Wordlist, pk)
    if not wl:
        raise HTTPException(status_code=404, detail="Wordlist not found")

    if wordlist.name is not None:
        wl.name = wordlist.name
    if wordlist.words is not None:
        wl.words = wordlist.words

    session.add(wl)
    session.commit()
    session.refresh(wl)

    definitions = []
    for word in wl.words:
        eng_def = get_word_definition(word, session)
        definitions.append(WordDefinitionResponse(word=word, definition=eng_def))
    return WordlistResponse(id=wl.id, name=wl.name, words=definitions)


@router.delete('/{pk}')
def delete_wordlist_endpoint(pk: int, session: SessionDep):
    """Delete a wordlist."""
    wl = session.get(Wordlist, pk)
    if not wl:
        raise HTTPException(status_code=404, detail="Wordlist not found")

    session.delete(wl)
    session.commit()
    return {"detail": "Wordlist deleted"}
