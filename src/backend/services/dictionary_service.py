import logging
import requests
from sqlmodel import Session, select

from backend.models.dict_english import Dictionary, EnglishDialect

from backend.models.dict_english import (
    EnglishWordDefinition, EnglishWordEntry,
    EnglishPosGroup, EnglishSense, EnglishTranslation,
    Example, AudioInfo
)
from backend.models.shared import Definition


class DictionaryApiClient:
    """Client for the Free Dictionary API."""
    url = 'https://api.dictionaryapi.dev/api/v2/entries/en/{}'

    @staticmethod
    def define(word: str) -> list:
        """Get definition data for a word."""
        response = requests.get(DictionaryApiClient.url.format(word))
        if response.status_code != 200:
            raise Exception(f"Error fetching definition for word: {word}")
        return response.json()


def parse_english_word_definition(api_data: list, word: str) -> EnglishWordDefinition:
    """
    Parse the API response (list) into an EnglishWordDefinition instance.
    """
    if not api_data:
        return EnglishWordDefinition(
            word=word,
            entries=[],
            audio=None,
            dialect=EnglishDialect.us
        )

    entry = api_data[0]

    # Pick the first valid audio link and determine dialect
    audio_url = None
    dialect = EnglishDialect.us
    audio_text = word

    for phon in entry.get("phonetics", []):
        audio = phon.get("audio")
        if audio:
            audio_url = audio
            if "uk" in audio:
                dialect = EnglishDialect.uk
            else:
                dialect = EnglishDialect.us
            break

    # Create audio info if we have a URL
    audio_info = AudioInfo(
        text=audio_text,
        audio_url=audio_url,
        lang="en"
    ) if audio_url else None

    # Process part-of-speech groups
    pos_groups = []
    for meaning in entry.get("meanings", []):
        part_of_speech = meaning.get("partOfSpeech", "")

        # Process senses (definitions)
        senses = []
        for d in meaning.get("definitions", []):
            examples = []
            if d.get("example"):
                # Create an example with the same text in both fields
                # since English API doesn't provide translations
                examples.append(Example(
                    source_text=d.get("example", ""),
                    target_text=d.get("example", "")
                ))

            # Create a translation (definition in English terminology)
            definition_translation = EnglishTranslation(
                examples=examples,
            )

            # Create a sense with this translation
            senses.append(EnglishSense(
                context_en=d.get("definition", ""),  # Context is definition in API
                translations=[definition_translation],
                synonyms=d.get("synonyms", []),
                antonyms=d.get("antonyms", [])
            ))

        # Create a POS group with these senses
        pos_groups.append(EnglishPosGroup(
            pos=part_of_speech,
            senses=senses
        ))

    # Create a single entry
    entries = [
        EnglishWordEntry(
            word=word,
            pos_groups=pos_groups
        )
    ]

    return EnglishWordDefinition(
        word=word,
        entries=entries,
        audio=audio_info,
        dialect=dialect
    )


def get_english_word_definition(words: list[str], session: Session, read_only: bool = False) -> list[Definition]:
    """
    Get a word definition from cache or the dictionary API.
    Returns the definition as a dictionary to match SpanishWordDefinition response format.
    """
    # Check cache if session is provided
    if session:
        dictionary_from_db = session.exec(
            select(Dictionary).where(Dictionary.word.in_(words))
        ).fetchall()
        dictionary_entries_map = {
            item.word: item for item in dictionary_from_db
        }
    else:
        dictionary_entries_map = {}

    result = []
    for word in words:
        dictionary_entry = dictionary_entries_map.get(word)

        if dictionary_entry is None:
            if read_only:
                result.append(EnglishWordDefinition.init_empty(
                    word=word,
                ))
                continue
            try:
                api_data = DictionaryApiClient.define(word)
                english_def = parse_english_word_definition(api_data, word)
            except Exception as e:
                english_def = EnglishWordDefinition.init_empty(
                    word=word,
                )

            # Store as dictionary for flexibility
            dictionary_entry = Dictionary(word=word, word_meta=english_def.model_dump())
            session.add(dictionary_entry)
            session.commit()
            session.refresh(dictionary_entry)

            result.append(english_def)
        else:
            # Return the stored dictionary directly
            result.append(EnglishWordDefinition.model_validate(dictionary_entry.word_meta))
    return result
