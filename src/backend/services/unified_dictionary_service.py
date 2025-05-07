import logging
from sqlmodel import Session
from typing import Dict, Optional
from fastapi import HTTPException

from ..services.dictionary_service import get_english_word_definition as get_english_definition
from ..services.dict_spanish_service import get_spanish_word_definition


def get_word_definition(words: list[str],
                        language: str = "en",
                        session: Session = None,
                        include_conjugations: bool = False,
                        override_cache: bool = False,
                        read_only: bool = False) -> list[dict]:
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
    logging.info(words)
    try:
        if language.lower() == "en":
            return get_english_definition(words, session,read_only=read_only)
        elif language.lower() == "es":
            return get_spanish_word_definition(words, include_conjugations, session, override_cache, read_only=read_only)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported language: {language}")
    except Exception as e:
        raise
