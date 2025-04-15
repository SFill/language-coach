from sqlmodel import Session
from typing import Dict, Optional
from fastapi import HTTPException

from ..services.dictionary_service import get_word_definition as get_english_definition
from ..services.dict_spanish_service import get_spanish_word_definition


def get_word_definition(word: str, language: str = "en", session: Session = None,
                        include_conjugations: bool = False) -> Dict:
    """
    Get a word definition in the specified language.

    Args:
        word: The word to look up
        language: Language code ('en' for English, 'es' for Spanish)
        session: Database session for caching
        include_conjugations: Whether to include verb conjugations (Spanish only)

    Returns:
        Dictionary with word definition that can be used in WordDefinitionResponse
    """
    try:
        if language.lower() == "en":
            return get_english_definition(word, session)
        elif language.lower() == "es":
            return get_spanish_word_definition(word, include_conjugations, session)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported language: {language}")
    except Exception as e:
        raise
        # # Return an empty definition structure if there's an error
        # if language.lower() == "en":
        #     return {
        #         "word": word,
        #         "entries": [],
        #         "audio": None,
        #         "dialect": "us"
        #     }
        # elif language.lower() == "es":
        #     return {
        #         "word": word,
        #         "entries": [],
        #         "conjugations": None,
        #         "spanish_audio": None,
        #         "english_audio": None
        #     }
        # else:
        #     raise HTTPException(status_code=400, detail=f"Unsupported language: {language}")
