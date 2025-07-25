import logging
import requests
from bs4 import BeautifulSoup
import json
import re
from typing import Dict, List, Optional, Any, Tuple
from sqlmodel import Session, select
from fastapi import HTTPException

from backend.models.dict_spanish import SpanishDictionary

from backend.models.dict_spanish import (
    SpanishWordEntry, SpanishWordDefinition, VerbConjugations,
    Participle, ConjugationForm, Translation,
    Sense, PosGroup
)
from backend.models.shared import Definition, Example, AudioInfo


class SpanishDictClient:
    """
    A client for parsing and extracting information from SpanishDict.com
    """

    # [backend.. Client implementation unchanged backend..]
    BASE_URL = "https://www.spanishdict.com"
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
    }

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(self.HEADERS)

    def get_word_data(self, word: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Get comprehensive data for a specific word

        Args:
            word: The word to look up

        Returns:
            Tuple containing:
            - Dictionary with word definitions
            - Dictionary with audio and pronunciation info
        """
        url = f"{self.BASE_URL}/translate/{word}"
        response = self.session.get(url)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        # Extract initial state data if available
        component_data = self._extract_initial_state(soup)

        if not component_data:
            return {}, {}

        # Extract word definitions
        word_defs = {}
        if 'sdDictionaryResultsProps' in component_data and 'entry' in component_data['sdDictionaryResultsProps']:
            word_defs = component_data['sdDictionaryResultsProps']['entry'].get('neodict', {})

        # Extract audio and pronunciation info
        audio_info = {}
        if 'resultCardHeaderProps' in component_data and 'headwordAndQuickdefsProps' in component_data['resultCardHeaderProps']:
            audio_info = component_data['resultCardHeaderProps']['headwordAndQuickdefsProps']

        return word_defs, audio_info

    def _extract_initial_state(self, soup: BeautifulSoup) -> Dict[str, Any]:
        """
        Extract data from the initial state JSON if available
        """
        try:
            # Look for the script that contains the initial state data
            for script in soup.find_all('script'):
                if script.string and 'window.SD_COMPONENT_DATA' in script.string:
                    # Extract the JSON data
                    json_str = re.search(r'window\.SD_COMPONENT_DATA\s*=\s*({.*});', script.string, re.DOTALL)
                    if json_str:
                        return json.loads(json_str.group(1))
        except (json.JSONDecodeError, AttributeError) as e:
            print(f"Error extracting initial state: {e}")

        return {}

    def get_conjugations(self, verb: str) -> Dict[str, Any]:
        """
        Get conjugation tables for a verb
        """
        url = f"{self.BASE_URL}/conjugate/{verb}"
        response = self.session.get(url)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        # Try to extract from initial state first
        data = self._extract_initial_state(soup)

        # Check if verb data is available in the extracted data
        if not (data and "verb" in data and data["verb"] and "paradigms" in data["verb"]):
            return {}

        paradigms = data["verb"]["paradigms"]

        # Process the paradigms into a more user-friendly format
        result = {
            "infinitive": data["verb"].get("infinitive", verb),
            "translation": data["verb"].get("infinitiveTranslation", ""),
            "is_reflexive": data["verb"].get("isReflexive", False),
            "tenses": {}
        }

        # Add participles if available
        if "pastParticiple" in data["verb"]:
            result["past_participle"] = {
                "spanish": data["verb"]["pastParticiple"].get("word", ""),
                "english": data["verb"]["pastParticiple"].get("wordTranslation", {}).get("word", "")
            }

        if "gerund" in data["verb"]:
            result["gerund"] = {
                "spanish": data["verb"]["gerund"].get("word", ""),
                "english": data["verb"]["gerund"].get("wordTranslation", {}).get("word", "")
            }
        result['tenses'] = paradigms

        return result


def parse_audio_info(raw_audio_data: Dict[str, Any]) -> Tuple[Optional[AudioInfo], Optional[AudioInfo]]:
    """Parse raw audio data into AudioInfo models."""
    spanish_audio = None
    english_audio = None

    # Extract Spanish audio info
    if 'headword' in raw_audio_data:
        hw = raw_audio_data['headword']

        spanish_audio = AudioInfo(
            text=hw.get('displayText', ''),
            audio_url=hw.get('audioUrl'),
            lang=hw.get('wordLang', 'es')
        )

    # Extract English audio info
    if 'quickdef1' in raw_audio_data and raw_audio_data['quickdef1']:
        qd = raw_audio_data['quickdef1']

        english_audio = AudioInfo(
            text=qd.get('displayText', ''),
            audio_url=qd.get('audioUrl'),
            lang=qd.get('wordLang', 'en')
        )

    return spanish_audio, english_audio


def parse_examples(raw_examples: List[Dict[str, str]]) -> List[Example]:
    """Parse raw examples into Example models."""
    examples = []

    for example in raw_examples:
        if 'textEs' in example and 'textEn' in example:
            examples.append(Example(
                source_text=example['textEs'],
                target_text=example['textEn']
            ))

    return examples


def parse_translations(raw_translations: List[Dict[str, Any]]) -> List[Translation]:
    """Parse raw translations into Translation models."""
    translations = []

    for trans in raw_translations:
        # Parse examples
        examples = parse_examples(trans.get('examples', []))

        translations.append(Translation(
            translation=trans.get('translation', ''),
            examples=examples,
            context=trans.get('contextEn', '')
        ))

    return translations


def parse_senses(raw_senses: List[Dict[str, Any]]) -> List[Sense]:
    """Parse raw senses into Sense models."""
    senses = []

    for sense in raw_senses:
        translations = parse_translations(sense.get('translations', []))

        senses.append(Sense(
            context_en=sense.get('contextEn', ''),
            context_es=sense.get('contextEs', ''),
            gender=sense.get('gender'),
            translations=translations
        ))

    return senses


def parse_pos_groups(raw_pos_groups: List[Dict[str, Any]]) -> List[PosGroup]:
    """Parse raw POS groups into PosGroup models."""
    pos_groups = []

    for group in raw_pos_groups:
        pos = group.get('pos', {}).get('nameEn', '')
        senses = parse_senses(group.get('senses', []))

        pos_groups.append(PosGroup(
            pos=pos,
            senses=senses
        ))

    return pos_groups


def parse_spanish_word_data(raw_data: List[Dict[str, Any]]) -> List[SpanishWordEntry]:
    """Parse raw API data into SpanishWordEntry models."""
    if not raw_data:
        return []

    entries = []
    for entry_data in raw_data:
        try:
            subheadword = entry_data.get('subheadword', '')
            pos_groups = parse_pos_groups(entry_data.get('posGroups', []))

            entries.append(SpanishWordEntry(
                word=subheadword,
                pos_groups=pos_groups
            ))
        except Exception as e:
            print(f"Error parsing word entry: {e}")

    return entries


def collect_verb_examples(word_data: List[Dict[str, Any]]) -> List[Example]:
    """Collect examples of verb usage from word data."""
    all_examples = []

    for entry in word_data:
        for pos_group in entry.get('posGroups', []):
            pos_name = pos_group.get('pos', {}).get('nameEn', '').lower()

            if 'verb' in pos_name:
                # Collect examples
                for sense in pos_group.get('senses', []):
                    for translation_item in sense.get('translations', []):
                        for example in translation_item.get('examples', []):
                            if 'textEs' in example and 'textEn' in example:
                                all_examples.append(Example(
                                    source_text=example['textEs'],
                                    target_text=example['textEn']
                                ))

    return all_examples


def parse_conjugation_data(raw_data: Dict[str, Any]) -> Optional[VerbConjugations]:
    """Parse raw conjugation data into VerbConjugations model."""
    if not raw_data:
        return None

    try:
        # Process participles
        past_participle = None
        if "past_participle" in raw_data:
            past_participle = Participle(
                spanish=raw_data["past_participle"]["spanish"],
                english=raw_data["past_participle"]["english"]
            )

        gerund = None
        if "gerund" in raw_data:
            gerund = Participle(
                spanish=raw_data["gerund"]["spanish"],
                english=raw_data["gerund"]["english"]
            )

        # Process tenses
        # {'conjugationForms': ['van a hablar'],
        # 'pronoun': 'ellos/ellas/Uds.',
        # 'audioQueryString': '?lang=es&text=van-a-hablar&key=dde69bb18001bb3ae25c79274f4f2c0e',
        # 'translationForms': [{'word': 'are going to speak', 'pronoun': 'they'}]},
        tenses = {}
        for tense_name, tense_data in raw_data.get("tenses", {}).items():
            conjugations = []
            for conj_data in tense_data:
                conjugations.append(ConjugationForm(
                    forms=conj_data["conjugationForms"] or [],
                    pronoun=conj_data["pronoun"],
                    audio_query_string=conj_data.get("audioQueryString", ""),  # rare cases
                    translations=conj_data.get("translationForms", []),  # rare cases
                ))
            tenses[tense_name] = conjugations

        return VerbConjugations(
            infinitive=raw_data["infinitive"],
            translation=raw_data["translation"],
            is_reflexive=raw_data["is_reflexive"] > 0,  # probably 1 and bigger means yes
            past_participle=past_participle,
            gerund=gerund,
            tenses=tenses,
            examples=[]
        )
    except Exception as e:
        print(f"Error parsing conjugation data: {e}")
        return None


def is_verb(entries: List[SpanishWordEntry]) -> bool:
    """Check if the word is a verb based on its part of speech."""
    for entry in entries:
        for pos_group in entry.pos_groups:
            pos_name = pos_group.pos.lower()
            if 'verb' in pos_name:
                return True
    return False


def get_spanish_word_definition(words: list[str], include_conjugations: bool = False, session: Session = None, override_cache: bool = False, read_only: bool = False) -> list[Definition]:
    """
    Get a Spanish word definition from cache or the SpanishDict API.

    Args:
        word: The word to look up
        include_conjugations: Whether to include verb conjugations
        session: Database session for caching

    Returns:
        List of dictionaries with word information to match WordDefinitionResponse format
    """
    # override_cache = True
    # normalizing to be not case sensitive
    words = [_.lower() for _ in words]
    # Check cache if session is provided
    if not override_cache and session:
        dictionary_from_db = session.exec(
            select(SpanishDictionary).where(SpanishDictionary.word.in_(words))
        ).fetchall()
        dictionary_entries_map = {
            item.word: item for item in dictionary_from_db
        }
    else:
        dictionary_entries_map = {}

    result = []
    logging.debug(f"map:{dictionary_entries_map}")
    for word in words:
        dictionary_entry = dictionary_entries_map.get(word)
        logging.debug(f"word:{word}")
        if dictionary_entry:
            entries = [SpanishWordEntry(**entry) for entry in dictionary_entry.word_data]
            audio_data = dictionary_entry.audio_data
            conjugation_data = dictionary_entry.conjugation_data
            logging.debug("found a word")
        else:
            entries = None
            audio_data = None
            conjugation_data = None
            if read_only:
                result.append(
                    SpanishWordDefinition.init_empty(word=word)
                )
                logging.debug("not found a word, continue")
                continue

        # If not in cache or no session provided, fetch word data from API
        if not entries:
            client = SpanishDictClient()
            word_data, audio_data = client.get_word_data(word)

            # Parse the data into our Pydantic models
            entries = parse_spanish_word_data(word_data)

            # Cache the data if session is provided
            if session and entries:
                if dictionary_entry:
                    # Update existing entry
                    dictionary_entry.word_data = entries
                    dictionary_entry.audio_data = audio_data
                else:
                    # Create new entry
                    dictionary_entry = SpanishDictionary(
                        word=word,
                        word_data=[_.model_dump() for _ in entries],
                        audio_data=audio_data
                    )
                session.add(dictionary_entry)
                session.commit()

        # Fetch conjugation data if this is a verb and conjugations are requested
        conjugations = None
        if include_conjugations and is_verb(entries):
            # Check if we already have conjugation data in cache
            if dictionary_entry and dictionary_entry.conjugation_data:
                conjugation_data = dictionary_entry.conjugation_data
            # If no cache or not in cache, fetch from API
            else:
                client = SpanishDictClient()
                conjugation_data = client.get_conjugations(word)

                # Update cache with conjugation data
                if session and conjugation_data:
                    dictionary_entry.conjugation_data = conjugation_data
                    session.add(dictionary_entry)
                    session.commit()

            # Parse conjugation data if available
            if include_conjugations and conjugation_data:
                conjugations = parse_conjugation_data(conjugation_data)
                
        # Parse audio data
        spanish_audio, english_audio = parse_audio_info(audio_data)

        # Create the SpanishWordDefinition object
        spanish_def = SpanishWordDefinition(
            word=word,
            entries=entries,
            conjugations=conjugations,
            spanish_audio=spanish_audio,
            english_audio=english_audio,
        )
        result.append(spanish_def)
        # add as dictionary to match WordDefinitionResponse format
    return result
