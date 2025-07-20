"""
Fixture loader for real Spanish dictionary payloads.
Provides easy access to real API responses for testing.
"""

import json
from pathlib import Path
from typing import Dict, Any, Tuple

# Path to payload directory
PAYLOAD_DIR = Path(__file__).parent / "spanish_dict_payloads"

class SpanishDictFixtures:
    """Helper class to load real Spanish dictionary payloads for testing."""
    
    @staticmethod
    def load_word_data(word: str) -> Dict[str, Any]:
        """Load word data payload for a specific word."""
        file_path = PAYLOAD_DIR / f"{word}_word_data.json"
        if not file_path.exists():
            raise FileNotFoundError(f"Word data not found for '{word}' at {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    @staticmethod
    def load_audio_data(word: str) -> Dict[str, Any]:
        """Load audio data payload for a specific word."""
        file_path = PAYLOAD_DIR / f"{word}_audio_data.json"
        if not file_path.exists():
            raise FileNotFoundError(f"Audio data not found for '{word}' at {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    @staticmethod
    def load_conjugations(word: str) -> Dict[str, Any]:
        """Load conjugation data payload for a specific verb."""
        file_path = PAYLOAD_DIR / f"{word}_conjugations.json"
        if not file_path.exists():
            raise FileNotFoundError(f"Conjugation data not found for '{word}' at {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    @staticmethod
    def load_complete_word_data(word: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Load both word data and audio data for a word (matching API response format)."""
        return SpanishDictFixtures.load_word_data(word), SpanishDictFixtures.load_audio_data(word)
    
    @staticmethod
    def get_available_words() -> list[str]:
        """Get list of words that have payloads available."""
        words = set()
        for file in PAYLOAD_DIR.glob("*_word_data.json"):
            word = file.stem.replace("_word_data", "")
            words.add(word)
        return sorted(list(words))
    
    @staticmethod
    def get_available_verbs() -> list[str]:
        """Get list of verbs that have conjugation data available."""
        verbs = []
        for file in PAYLOAD_DIR.glob("*_conjugations.json"):
            verb = file.stem.replace("_conjugations", "")
            verbs.append(verb)
        return sorted(verbs)

# Convenience functions for common words
def get_hola_data() -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Get real data for 'hola' - simple interjection."""
    return SpanishDictFixtures.load_complete_word_data("hola")

def get_casa_data() -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Get real data for 'casa' - feminine noun."""
    return SpanishDictFixtures.load_complete_word_data("casa")

def get_correr_data() -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Get real data for 'correr' - regular verb."""
    return SpanishDictFixtures.load_complete_word_data("correr")

def get_correr_conjugations() -> Dict[str, Any]:
    """Get real conjugation data for 'correr'."""
    return SpanishDictFixtures.load_conjugations("correr")

def get_ser_data() -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Get real data for 'ser' - irregular verb."""
    return SpanishDictFixtures.load_complete_word_data("ser")

def get_ser_conjugations() -> Dict[str, Any]:
    """Get real conjugation data for 'ser'."""
    return SpanishDictFixtures.load_conjugations("ser")