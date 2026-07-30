import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Annotated, List, Optional
from sqlmodel import Session, select, desc

from backend.database import get_session
from backend.models.wordlist import (
    Wordlist, WordlistCreate, WordlistUpdate,
    WordlistResponse, Language, WordInList
)
from backend.services.phrase_service import get_phrase_with_example_and_translation, translate_phrase_and_example_with_google, translate_phrase_and_example_with_gpt

# Create router
router = APIRouter(prefix="/api/wordlist", tags=["wordlist"])

# Type alias for session dependency
SessionDep = Annotated[Session, Depends(get_session)]


def _process_word(
    word: WordInList,
    stored: Optional[dict],
    list_language: str,
    session: Session,
    use_gpt_translation: bool,
    test_mode: bool = False,
) -> dict:
    """Build a persisted word dict, regenerating translations only when needed.

    Translations are kept from `stored` when the incoming `version` matches the
    stored one AND the stored translations are present AND the word/example_phrase
    are unchanged. Otherwise translations are regenerated from `word` + the
    (preserved) `example_phrase`, translating to English. `example_phrase` is
    never overwritten when present — it is only auto-generated when missing.

    `test_mode` skips the GPT/Google calls and substitutes deterministic fake
    translations so tests can create/edit wordlists hermetically without an AI
    backend. The version-based keep-stored logic is unchanged in test mode.
    """
    wid = word.id or (stored.get("id") if stored else None) or str(uuid.uuid4())

    version_matches = stored is not None and stored.get("version") == word.version
    keep_stored = (
        version_matches
        and stored.get("word_translation")
        and stored.get("example_phrase_translation")
        and stored.get("word") == word.word
        and stored.get("example_phrase") == word.example_phrase
    )
    if keep_stored:
        return {
            "id": wid,
            "word": word.word,
            "version": word.version,
            "word_translation": stored["word_translation"],
            "example_phrase": word.example_phrase,
            "example_phrase_translation": stored["example_phrase_translation"],
        }

    if test_mode:
        # Deterministic fake translation — no external API. example_phrase is
        # preserved when present, auto-filled from the word when missing.
        phrase = word.example_phrase or f"{word.word} example"
        return {
            "id": wid,
            "word": word.word,
            "version": word.version,
            "word_translation": f"[test:{word.word}]",
            "example_phrase": phrase,
            "example_phrase_translation": f"[test:{phrase}]",
        }

    if not word.example_phrase:
        # No example phrase yet — auto-generate one plus its translations.
        word_data = get_phrase_with_example_and_translation(
            phrase=word.word,
            language=list_language,
            target_language="en",
            proficiency="intermediate",
            session=session,
            use_gpt_translation=use_gpt_translation,
        )
        return {
            "id": wid,
            "word": word.word,
            "version": word.version,
            "word_translation": word.word_translation or word_data["word_translation"],
            "example_phrase": word_data["example_phrase"],
            "example_phrase_translation": word_data["example_phrase_translation"],
        }

    # example_phrase present — translate the word + example, keep example_phrase as-is.
    try:
        if use_gpt_translation:
            translations = translate_phrase_and_example_with_gpt(word.word, word.example_phrase, "en")
        else:
            translations = translate_phrase_and_example_with_google(word.word, word.example_phrase, "en")
    except Exception as e:
        logging.exception('error getting translation')
        raise HTTPException(status_code=500, detail=f"Failed to translate: {str(e)}")

    return {
        "id": wid,
        "word": word.word,
        "version": word.version,
        "word_translation": translations["phrase_translation"],
        "example_phrase": word.example_phrase,
        "example_phrase_translation": translations["example_translation"],
    }


@router.get('/', response_model=list[WordlistResponse])
def list_wordlists_endpoint(
    session: SessionDep,
    language: str = Query("en", description="Language code (en or es)")
):
    """Get a list of all wordlists with definitions for the specified language."""
    # Filter wordlists by language
    wordlists = session.exec(
        select(Wordlist).where(Wordlist.language == language).order_by(desc(Wordlist.name))
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
    use_gpt_translation: bool = Query(False, description="Use GPT for translation instead of Google Translate"),
    test_mode: bool = Query(False, description="Skip AI translation; use deterministic fake translations (for tests)")
):
    """Create a new wordlist."""
    # Use the language from the request body if provided, otherwise use the query parameter
    list_language = wordlist.language or language

    # Validate language
    if list_language not in [e.value for e in Language]:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {list_language}")

    # Fill missing information for words (new list → nothing stored yet)
    processed_words = [
        _process_word(word, None, list_language, session, use_gpt_translation, test_mode)
        for word in wordlist.words
    ]

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
    use_gpt_translation: bool = Query(False, description="Use GPT for translation instead of Google Translate"),
    test_mode: bool = Query(False, description="Skip AI translation; use deterministic fake translations (for tests)")
):
    """Update a wordlist."""
    wl = session.get(Wordlist, pk)
    if not wl:
        raise HTTPException(status_code=404, detail="Wordlist not found")

    if wordlist.language not in [e.value for e in Language]:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {wordlist.language}")

    # Match incoming words to the stored ones by id so unchanged words (same
    # version) keep their stored translations instead of being retranslated.
    stored_by_id = {w.get("id"): w for w in (wl.words or []) if w.get("id")}
    processed_words = [
        _process_word(word, stored_by_id.get(word.id), wordlist.language, session, use_gpt_translation, test_mode)
        for word in wordlist.words
    ]

    wl.name = wordlist.name
    wl.words = processed_words
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
