import requests
from sqlmodel import Session, select
from ..models.wordlist import (
    Dictionary, EnglishWordDefinition, EnglishWordEntry, 
    EnglishDialect, EnglishPosGroup, EnglishSense, EnglishTranslation,
    Example, AudioInfo
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


def get_word_definition(word: str, session: Session) -> dict:
    """
    Get a word definition from cache or the dictionary API.
    Returns the definition as a dictionary to match SpanishWordDefinition response format.
    """
    dictionary_entry = session.exec(select(Dictionary).where(Dictionary.word == word)).first()
    
    if dictionary_entry is None:
        try:
            api_data = DictionaryApiClient.define(word)
            english_def = parse_english_word_definition(api_data, word)
        except Exception as e:
            english_def = EnglishWordDefinition(
                word=word, 
                entries=[], 
                audio=None,
                dialect=EnglishDialect.us
            )
            
        # Store as dictionary for flexibility
        # TODO uncomment
        # dictionary_entry = Dictionary(word=word, word_meta=english_def.dict())
        # session.add(dictionary_entry)
        # session.commit()
        # session.refresh(dictionary_entry)
        
        return english_def.dict()
    else:
        # Return the stored dictionary directly
        return dictionary_entry.word_meta