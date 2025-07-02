#!/usr/bin/env python3
"""
Integration of GDEX scoring into the Sentence Retriever for Language Coach.
"""

import re
import pickle
import logging
from pathlib import Path
from typing import Dict, List, Any
from collections import defaultdict

from sqlmodel import Session, create_engine, select

from .db_models import Text, Phrase
from .gdex import GdexScorer


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Constants
INDEX_DIR = Path("data/gutenberg_data/indexes")
MAX_SENTENCE_TOKENS = 30  # Maximum sentence length in tokens
IDEAL_TOKEN_RANGE = (5, 25)  # Ideal range for sentence length

# Regex for quick tokenization
# This handles common punctuation and whitespace without needing spaCy
TOKEN_PATTERN = re.compile(r'[a-zA-Z0-9]+|[^\w\s]')


def quick_tokenize(text: str) -> List[str]:
    """
    A very fast tokenization function that approximates spaCy but is much faster.
    
    Args:
        text: Text to tokenize
        
    Returns:
        List of token strings
    """
    # Find all matches
    return [token.lower() for token in TOKEN_PATTERN.findall(text) 
            if token.strip() and not token.strip() in ',.;:!?()[]{}""\'']


class SentenceRetriever:
    def __init__(self, db_path: str, user_proficiency: str = "intermediate"):
        """
        Initialize the sentence retriever with database connection.
        
        Args:
            db_path: Path to the SQLite database
            user_proficiency: User proficiency level ("beginner", "intermediate", "advanced")
        """
        self.db_path = db_path
        self.engine = create_engine(f"sqlite:///{db_path}", echo=False)
        self.user_proficiency = user_proficiency
        
        # Initialize GDEX scorers
        self.gdex_scorers = {
            'en': GdexScorer(language='en', proficiency=user_proficiency),
            'es': GdexScorer(language='es', proficiency=user_proficiency)
        }
        
        # Ensure index directory exists
        INDEX_DIR.mkdir(parents=True, exist_ok=True)
        
        # Try to load existing indexes
        self.index_data = {}
        self._load_existing_indexes()
    
    def _load_existing_indexes(self) -> None:
        """Attempt to load existing sentence indexes from disk."""
        for language in ["en", "es"]:
            index_path = INDEX_DIR / f"sentence_index_{language}.pkl"
            if index_path.exists():
                try:
                    with open(index_path, 'rb') as f:
                        self.index_data[language] = pickle.load(f)
                    logger.info(f"Loaded existing sentence index for {language} from {index_path}")
                except Exception as e:
                    logger.error(f"Error loading sentence index for {language}: {str(e)}")
    
    def build_sentence_index(self, language: str) -> Dict:
        """
        Build sentence index for a specific language.
        
        Args:
            language: ISO language code (e.g., 'en', 'es')
            
        Returns:
            Dictionary with index data
        """
        # Get all sentences for the language
        with Session(self.engine) as session:
            # Query for sentences in this language
            query = select(Phrase).where(Phrase.language == language)
            phrases = session.exec(query).all()
            
            if not phrases:
                logger.warning(f"No phrases found for language: {language}")
                return {}
                
            logger.info(f"Found {len(phrases)} phrases for language: {language}")
            
            # Save phrase IDs and texts for later retrieval
            phrase_ids = []
            texts = []
            tokenized_texts = []
            
            # Build an inverted index for fast token lookup
            token_to_phrases = defaultdict(set)
            
            # First, do a quick pre-filtering with split() to eliminate obviously long sentences
            candidate_phrases = []
            for phrase in phrases:
                # Quick check if sentence is likely too long (more than 35 words)
                # This is a loose upper bound that guarantees we don't miss anything
                if len(phrase.text.split()) <= 35:
                    candidate_phrases.append(phrase)
            
            logger.info(f"After quick pre-filtering, processing {len(candidate_phrases)} phrases")
            
            # Process candidate phrases in batches for better performance
            batch_size = 1000
            for i in range(0, len(candidate_phrases), batch_size):
                batch = candidate_phrases[i:i+batch_size]
                
                # Use faster tokenization for length checking
                for phrase in batch:
                    tokens = quick_tokenize(phrase.text)
                    
                    if len(tokens) <= MAX_SENTENCE_TOKENS:
                        phrase_id = phrase.id
                        phrase_text = phrase.text
                        
                        phrase_ids.append(phrase_id)
                        texts.append(phrase_text)
                        tokenized_texts.append(tokens)
                        
                        # Add to inverted index
                        for token in set(tokens):  # Use set to avoid duplicates
                            token_to_phrases[token].add(len(phrase_ids) - 1)  # Store the index in our lists
            
            logger.info(f"After filtering for length, keeping {len(texts)} phrases")
            
            if not tokenized_texts:
                logger.warning(f"No suitable phrases found for indexing in language: {language}")
                return {}
            
            # Get additional metadata for these phrases
            # Process metadata in batches to avoid memory issues
            phrase_metadata = {}
            batch_size = 500
            
            for i in range(0, len(phrase_ids), batch_size):
                batch_ids = phrase_ids[i:i+batch_size]
                
                # Query for all phrases in this batch at once
                batch_phrases = session.exec(
                    select(Phrase, Text)
                    .join(Text, Phrase.text_id == Text.id)
                    .where(Phrase.id.in_(batch_ids))
                ).all()
                
                for phrase_data in batch_phrases:
                    phrase, text = phrase_data
                    phrase_metadata[phrase.id] = {
                        "text_id": text.id,
                        "title": text.title,
                        "category": text.category
                    }
            
            # Prepare and return the data
            index_data = {
                'phrase_ids': phrase_ids,
                'texts': texts,
                'tokenized_texts': tokenized_texts,
                'token_to_phrases': dict(token_to_phrases),  # Convert to regular dict for pickling
                'metadata': phrase_metadata
            }
            
            # Save the index to file
            index_path = INDEX_DIR / f"sentence_index_{language}.pkl"
            with open(index_path, 'wb') as f:
                pickle.dump(index_data, f)
                
            logger.info(f"Saved sentence index for {language} to {index_path}")
            
            # Update the in-memory data
            self.index_data[language] = index_data
            
            return index_data
    
    def get_best_examples(
        self, 
        phrase: str, 
        language: str, 
        top_n: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Get the best example sentences for a phrase.
        
        Args:
            phrase: The word or phrase to search for
            language: ISO language code (e.g., 'en', 'es')
            top_n: Number of top examples to return
            
        Returns:
            List of dictionaries with sentence examples and metadata
        """
        # Check if we have an index for this language
        if language not in self.index_data:
            logger.error(f"No sentence index available for language: {language}")
            return []
        
        # Get index data
        index_data = self.index_data[language]
        
        # Tokenize the query with the same fast tokenizer used for indexing
        query_tokens = quick_tokenize(phrase)
        
        # Find matching phrases for each token
        matching_phrases = set()
        token_to_phrases = index_data['token_to_phrases']
        
        # Find sentences containing all query tokens
        for token in query_tokens:
            phrase_indices = token_to_phrases.get(token, set())
            if not matching_phrases:
                matching_phrases = set(phrase_indices)
            else:
                matching_phrases &= phrase_indices  # Intersection
        
        # we don't need partial matches as we look for complete examples
        if not matching_phrases:
            return []
        
        # Get the GDEX scorer for this language
        gdex_scorer = self.gdex_scorers.get(language)
        if not gdex_scorer:
            raise ValueError(f"no scorer for {language}")
        
        # Prepare results
        results = []
        for idx in matching_phrases:
            text = index_data['texts'][idx]
            phrase_id = index_data['phrase_ids'][idx]
            tokens = index_data['tokenized_texts'][idx]
            
            # Use GDEX scoring
            scores = gdex_scorer.score_sentence(text, phrase, tokens)
            combined_score = scores['total']
            if combined_score < 0.8:
                continue 
            
            # Add detailed scores for debugging
            detailed_scores = {f"gdex_{k}": v for k, v in scores.items() if k != 'total'}
           
            # Get metadata
            metadata = index_data['metadata'].get(phrase_id, {})
            
            # Add to results
            results.append({
                'sentence': text,
                'score': combined_score,
                'text_id': metadata.get('text_id'),
                'title': metadata.get('title'),
                'category': metadata.get('category'),
                'detailed_scores': detailed_scores
            })
        
        # Sort by score and return top results
        top_results = sorted(results, key=lambda x: x['score'], reverse=True)[:top_n]
        return top_results
    
    def _score_word_position(self, sentence: str, phrase: str) -> float:
        """
        Score based on position of target phrase in sentence.
        
        Args:
            sentence: The sentence to score
            phrase: The target phrase
            
        Returns:
            Position score (0.0 to 1.0)
        """
        words = sentence.lower().split()
        phrase_lower = phrase.lower()
        
        # For multi-word phrases, look for consecutive words
        if len(phrase_lower.split()) > 1:
            # First check for exact phrase match
            if phrase_lower in sentence.lower():
                # Find the position of the phrase
                start_idx = sentence.lower().find(phrase_lower)
                
                # Count words before the phrase to get position
                text_before = sentence.lower()[:start_idx]
                word_count_before = len(text_before.split())
                
                # Calculate position as the middle of the phrase
                phrase_length = len(phrase_lower.split())
                position = word_count_before + (phrase_length / 2)
                
                # Normalize position to 0-1 range
                sentence_length = len(words)
                normalized_pos = position / (sentence_length - 1) if sentence_length > 1 else 0.5
                
                # Score highest for positions in the middle (around 0.5)
                return 1.0 - abs(normalized_pos - 0.5) * 2
                
            return 0.5  # Default score for phrases that don't match exactly
        
        # Single word processing
        # Find all occurrences of the word
        positions = []
        for i, w in enumerate(words):
            if phrase_lower in w:  # Allow partial matches
                positions.append(i)
        
        if not positions:
            return 0.0
        
        # Calculate position score (middle positions are best)
        sentence_length = len(words)
        position_scores = []
        
        for pos in positions:
            # Normalize position to 0-1 range
            normalized_pos = pos / (sentence_length - 1) if sentence_length > 1 else 0.5
            
            # Score highest for positions in the middle (around 0.5)
            position_score = 1.0 - abs(normalized_pos - 0.5) * 2
            position_scores.append(position_score)
        
        # Return max score if word appears multiple times
        return max(position_scores)