import requests
from sqlmodel import Session, select
from ..models.wordlist import (
    Dictionary, EnglishWordDefinition, 
    EnglishDialect, WordMeaning, WordDefinitionDetail
)

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


def parse_english_word_definition(api_data: list) -> EnglishWordDefinition:
    """
    Parse the API response (list) into an EnglishWordDefinition instance.
    """
    if not api_data:
        return EnglishWordDefinition(audio_link=None, english_dialect=EnglishDialect.us, meanings=[])

    entry = api_data[0]

    # Pick the first valid audio link and determine dialect
    audio_link = None
    dialect = EnglishDialect.us
    for phon in entry.get("phonetics", []):
        audio = phon.get("audio")
        if audio:
            audio_link = audio
            if "uk" in audio:
                dialect = EnglishDialect.uk
            else:
                dialect = EnglishDialect.us
            break

    meanings = []
    for meaning in entry.get("meanings", []):
        part_of_speech = meaning.get("partOfSpeech")
        synonyms = meaning.get("synonyms", [])
        antonyms = meaning.get("antonyms", [])
        definitions = []
        for d in meaning.get("definitions", []):
            definitions.append(WordDefinitionDetail(
                definition=d.get("definition"),
                synonyms=d.get("synonyms", []),
                antonyms=d.get("antonyms", []),
                example=d.get("example")
            ))
        meanings.append(WordMeaning(
            part_of_speech=part_of_speech,
            definitions=definitions,
            synonyms=synonyms,
            antonyms=antonyms
        ))

    return EnglishWordDefinition(
        audio_link=audio_link,
        english_dialect=dialect,
        meanings=meanings
    )


def get_word_definition(word: str, session: Session) -> EnglishWordDefinition:
    """
    Get a word definition from cache or the dictionary API.
    """
    dictionary_entry = session.exec(select(Dictionary).where(Dictionary.word == word)).first()
    if dictionary_entry is None:
        try:
            api_data = DictionaryApiClient.define(word)
            english_def = parse_english_word_definition(api_data)
        except Exception as e:
            english_def = EnglishWordDefinition(audio_link=None, english_dialect=EnglishDialect.us, meanings=[])
        dictionary_entry = Dictionary(word=word, word_meta=english_def.dict())
        session.add(dictionary_entry)
        session.commit()
        session.refresh(dictionary_entry)
    else:
        english_def = EnglishWordDefinition(**dictionary_entry.word_meta)
    return english_def