import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Annotated, List, Optional
from sqlmodel import Session, select

from backend.database import get_session
from backend.models.wordlist import (
    Wordlist, WordlistCreate, WordlistUpdate,
    WordlistResponse, Language, WordInList
)
from backend.services.phrase_service import get_phrase_with_example_and_translation

# Create router
router = APIRouter(prefix="/api/wordlist", tags=["wordlist"])

# Type alias for session dependency
SessionDep = Annotated[Session, Depends(get_session)]


def convert_words_to_word_in_list(
    words: List[str], 
    language: str, 
    session: Session,
    use_gpt_translation: bool = False
) -> List[WordInList]:
    """Convert simple word strings to WordInList objects with translations and examples."""
    word_in_list_objects = []
    
    for word in words:
        try:
            # Get word with translation and example
            word_data = get_phrase_with_example_and_translation(
                phrase=word,
                language=language,
                target_language="en",
                proficiency="intermediate",
                session=session,
                use_gpt_translation=use_gpt_translation
            )
            
            word_in_list_objects.append(WordInList(
                word=word_data["word"],
                word_translation=word_data["word_translation"],
                example_phrase=word_data["example_phrase"],
                example_phrase_translation=word_data["example_phrase_translation"]
            ))
        except Exception as e:
            logging.error(f"Error processing word '{word}': {str(e)}")
            # Fallback to basic word object
            word_in_list_objects.append(WordInList(
                word=word,
                word_translation=word,
                example_phrase=word,
                example_phrase_translation=word
            ))
    
    return word_in_list_objects


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
        results.append(WordlistResponse(
            id=wl.id,
            name=wl.name,
            language=wl.language,
            words=wl.words
        ))
    return results


@router.post('/', response_model=WordlistResponse)
def create_wordlist_endpoint(
    wordlist: WordlistCreate,
    session: SessionDep,
    language: str = Query("en", description="Language code (en or es)"),
    use_gpt_translation: bool = Query(False, description="Use GPT for translation instead of Google Translate")
):
    """Create a new wordlist."""
    # Use the language from the request body if provided, otherwise use the query parameter
    list_language = wordlist.language or language

    # Validate language
    if list_language not in [e.value for e in Language]:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {list_language}")

    # Fill missing information for words
    processed_words = []
    for word in wordlist.words:
        if not word.word_translation or not word.example_phrase or not word.example_phrase_translation:
            # Fill missing information
            word_data = get_phrase_with_example_and_translation(
                phrase=word.word,
                language=list_language,
                target_language="en",
                proficiency="intermediate",
                session=session,
                use_gpt_translation=use_gpt_translation
            )
            processed_word = WordInList(
                word=word.word,
                word_translation=word.word_translation or word_data["word_translation"],
                example_phrase=word.example_phrase or word_data["example_phrase"],
                example_phrase_translation=word.example_phrase_translation or word_data["example_phrase_translation"]
            )
        else:
            processed_word = word
        processed_words.append(processed_word.model_dump())

    new_wordlist = Wordlist(
        name=wordlist.name,
        words=processed_words,
        language=list_language
    )
    session.add(new_wordlist)
    session.commit()
    session.refresh(new_wordlist)

    return WordlistResponse(
        id=new_wordlist.id,
        name=new_wordlist.name,
        language=new_wordlist.language,
        words=new_wordlist.words
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

    return WordlistResponse(
        id=wl.id,
        name=wl.name,
        language=wl.language,
        words=wl.words
    )


# we use sendBeacon method when page unloads to sync changes, but it only supports POST.
#  https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon
@router.post('/{pk}', response_model=WordlistResponse)
def update_wordlist_endpoint(
    pk: int,
    wordlist: WordlistUpdate,
    session: SessionDep,
    use_gpt_translation: bool = Query(False, description="Use GPT for translation instead of Google Translate")
):
    """Update a wordlist."""
    wl = session.get(Wordlist, pk)
    if not wl:
        raise HTTPException(status_code=404, detail="Wordlist not found")
    logging.info(wl)
    
    # Fill missing information for words
    processed_words = []
    for word in wordlist.words:
        if not word.word_translation or not word.example_phrase or not word.example_phrase_translation:
            # Fill missing information
            word_data = get_phrase_with_example_and_translation(
                phrase=word.word,
                language=wordlist.language,
                target_language="en",
                proficiency="intermediate",
                session=session,
                use_gpt_translation=use_gpt_translation
            )
            processed_word = WordInList(
                word=word.word,
                word_translation=word.word_translation or word_data["word_translation"],
                example_phrase=word.example_phrase or word_data["example_phrase"],
                example_phrase_translation=word.example_phrase_translation or word_data["example_phrase_translation"]
            ).model_dump()
            
        else:
            processed_word = word.model_dump()
        processed_words.append(processed_word)
    
    wl.name = wordlist.name
    wl.words = processed_words
    if wordlist.language not in [e.value for e in Language]:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {wordlist.language}")
    wl.language = wordlist.language

    session.add(wl)
    session.commit()
    session.refresh(wl)

    return WordlistResponse(
        id=wl.id,
        name=wl.name,
        language=wl.language,
        words=wl.words
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
