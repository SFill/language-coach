"""
Text Processing and Database Storage Classes

This module provides two classes:
1. TextProcessor - For tokenizing and tagging text using spaCy
2. DatabaseSaver - For saving processed text to database using Text, Phrase, Word models
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from sqlmodel import Session, select
import spacy
from ..services.sentence.db_models import Text, Phrase, Word

logger = logging.getLogger(__name__)


class TextProcessor:
    """
    Class for processing text with spaCy tagging.
    Uses spaCy for POS tagging only, not for tokenization.
    """
    
    def __init__(self):
        self._nlp_models = {}
    
    def _get_nlp_model(self, language: str) -> Optional[spacy.language.Language]:
        """Get or load spaCy model for language tagging."""
        if language not in self._nlp_models:
            try:
                if language == "en":
                    self._nlp_models[language] = spacy.load("en_core_web_sm", disable=["parser", "ner"])
                elif language == "es":
                    self._nlp_models[language] = spacy.load("es_core_news_sm", disable=["parser", "ner"])
                else:
                    # Default to English for unknown languages
                    self._nlp_models[language] = spacy.load("en_core_web_sm", disable=["parser", "ner"])
            except OSError:
                logger.warning(f"spaCy model for {language} not found, using basic tokenization")
                self._nlp_models[language] = None
        
        return self._nlp_models[language]
    
    def tokenize_with_basic_split(self, text: str) -> List[str]:
        """
        Basic tokenization using string split.
        Used as fallback when spaCy is not available.
        """
        # Simple tokenization - split by whitespace and punctuation
        import re
        tokens = re.findall(r'\w+|[^\w\s]', text)
        return tokens
    
    def process_text(self, text: str, language: str = "en") -> List[Dict[str, Any]]:
        """
        Process text and return tokenized words with POS tags.
        
        Args:
            text: Text to process
            language: Language code (e.g., 'en', 'es')
            
        Returns:
            List of dictionaries with word information
        """
        nlp_model = self._get_nlp_model(language)
        
        if nlp_model is None:
            # Fallback to basic tokenization
            tokens = self.tokenize_with_basic_split(text)
            return [
                {
                    "text": token,
                    "lemma": token.lower(),
                    "pos": "",
                    "tag": "",
                    "is_stop": False,
                    "is_punct": token in ".,;:!?",
                    "ent_type": ""
                }
                for token in tokens
            ]
        
        # Use spaCy for tagging
        doc = nlp_model(text)
        
        words = []
        for token in doc:
            word_info = {
                "text": token.text,
                "lemma": token.lemma_,
                "pos": token.pos_,
                "tag": token.tag_,
                "is_stop": token.is_stop,
                "is_punct": token.is_punct,
                "ent_type": token.ent_type_ if token.ent_type_ else ""
            }
            words.append(word_info)
        
        return words
    
    def process_sentence(self, sentence: str, language: str = "en") -> Dict[str, Any]:
        """
        Process a single sentence and return structured data.
        
        Args:
            sentence: Sentence text to process
            language: Language code
            
        Returns:
            Dictionary with sentence text and processed words
        """
        words = self.process_text(sentence, language)
        
        return {
            "text": sentence,
            "language": language,
            "words": words
        }


class DatabaseSaver:
    """
    Class for saving processed text to database using Text, Phrase, Word models.
    """
    
    def __init__(self, session: Session):
        self.session = session
    
    def save_sentence(
        self, 
        sentence: str, 
        language: str, 
        source: str,
        title: str,
        category: str,
        words_data: List[Dict[str, Any]]
    ) -> Optional[Tuple[Text, Phrase]]:
        """
        Save a sentence to database.
        
        Args:
            sentence: The sentence text
            language: Language code
            source: Source identifier (e.g., "ChatGpt", "manual", etc.)
            title: Title for the text entry
            category: Category/genre
            words_data: List of word information dictionaries
            
        Returns:
            Tuple of (text_id, phrase_id) if successful, None otherwise
        """
        try:
            # Step 1: Create or get the Text entry for this source
            text_entry = self.session.exec(
                select(Text).filter(
                    Text.source == source,
                    Text.language == language,
                    Text.title == title
                )
            ).first()
            
            if not text_entry:
                text_entry = Text(
                    title=title,
                    language=language,
                    source=source,
                    category=category
                )
                self.session.add(text_entry)
                self.session.flush()  # Get the ID
            
            text_id = text_entry.id
            
            # Step 2: Create the Phrase entry
            phrase_entry = Phrase(
                text=sentence,
                language=language,
                text_id=text_id
            )
            self.session.add(phrase_entry)
            self.session.flush()  # Get the ID

            phrase_id = phrase_entry.id
            
            # Step 3: Create Word entries
            word_entries = []
            for word_data in words_data:
                word_entry = Word(
                    text=word_data["text"],
                    lemma=word_data["lemma"],
                    pos=word_data["pos"],
                    tag=word_data["tag"],
                    is_stop=word_data["is_stop"],
                    is_punct=word_data["is_punct"],
                    ent_type=word_data["ent_type"],
                    phrase_id=phrase_id,
                    text_id=text_id
                )
                word_entries.append(word_entry)
            
        
            self.session.add_all(word_entries)
            
            # Commit the transaction
            self.session.commit()
            
            logger.info(f"Saved sentence from source '{source}' to database")
            return (text_entry, phrase_entry)
            
        except Exception as e:
            logger.exception(f"Error saving sentence: {str(e)}")
            self.session.rollback()
            return None, None
    