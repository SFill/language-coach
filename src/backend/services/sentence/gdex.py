#!/usr/bin/env python3
"""
GDEX (Good Dictionary EXamples) implementation for Language Coach.

This module provides scoring functions based on the GDEX algorithm to 
evaluate the quality of example sentences for language learning.
"""

import re
import math
from typing import List, Dict, Any, Set, Optional, Tuple


# Common function words for each language - these are considered "easy" words
# We'll use these as a simple substitute for full frequency lists
COMMON_WORDS_EN = {
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 
    'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 
    'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 
    'him', 'know', 'take', 'person', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 
    'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 
    'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 
    'any', 'these', 'give', 'day', 'most', 'us'
}

COMMON_WORDS_ES = {
    'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se', 'no', 'haber', 'por', 'con', 'su', 
    'para', 'como', 'estar', 'tener', 'le', 'lo', 'todo', 'pero', 'más', 'hacer', 'o', 'poder', 'decir', 
    'este', 'ir', 'otro', 'ese', 'si', 'me', 'ya', 'ver', 'porque', 'dar', 'cuando', 'él', 'muy', 'sin', 
    'vez', 'mucho', 'saber', 'qué', 'sobre', 'mi', 'alguno', 'mismo', 'yo', 'también', 'hasta', 'año', 
    'dos', 'querer', 'entre', 'así', 'primero', 'desde', 'grande', 'eso', 'ni', 'nos', 'llegar', 'pasar', 
    'tiempo', 'ella', 'día', 'uno', 'bien', 'poco', 'deber', 'entonces', 'poner', 'cosa', 'tanto', 'hombre', 
    'parecer', 'nuestro', 'tan', 'donde', 'ahora', 'parte', 'después', 'vida', 'quedar', 'siempre', 'creer', 
    'hablar', 'llevar', 'dejar', 'nada', 'cada', 'seguir', 'menos', 'nuevo', 'encontrar'
}

# Basic "blacklist" of words to avoid in examples
AVOID_WORDS_EN = {
    'fuck', 'shit', 'damn', 'hell', 'bastard', 'ass', 'asshole', 
    'bitch', 'cunt', 'dick', 'crap', 'piss', 'nigger', 'faggot'
}

AVOID_WORDS_ES = {
    'mierda', 'puta', 'joder', 'coño', 'cabrón', 'gilipollas',
    'hostia', 'carajo', 'follar', 'chingar', 'maricón', 'polla'
}

# Pronouns that might lack clear referents (should be penalized)
PRONOUNS_EN = {'it', 'they', 'them', 'their', 'he', 'she', 'his', 'her', 'this', 'that', 'these', 'those'}
PRONOUNS_ES = {'lo', 'la', 'los', 'las', 'él', 'ella', 'ellos', 'ellas', 'este', 'esta', 'estos', 'estas'}

# Configuration constants for GDEX scoring
IDEAL_LENGTH_RANGE = {
    'beginner': (5, 10),  # 5-10 tokens for beginners
    'intermediate': (7, 15),  # 7-15 tokens for intermediate
    'advanced': (10, 20),  # 10-20 tokens for advanced
}

MAX_LENGTH = 30  # Maximum acceptable sentence length


class GdexScorer:
    """GDEX implementation for scoring example sentences."""
    
    def __init__(self, language: str = 'en', proficiency: str = 'intermediate'):
        """
        Initialize the GDEX scorer.
        
        Args:
            language: Language code ('en' or 'es')
            proficiency: User proficiency level ('beginner', 'intermediate', 'advanced')
        """
        self.language = language.lower()
        self.proficiency = proficiency.lower()
        
        # Set up language-specific resources
        if self.language == 'en':
            self.common_words = COMMON_WORDS_EN
            self.avoid_words = AVOID_WORDS_EN
            self.pronouns = PRONOUNS_EN
        elif self.language == 'es':
            self.common_words = COMMON_WORDS_ES
            self.avoid_words = AVOID_WORDS_ES
            self.pronouns = PRONOUNS_ES
        else:
            raise ValueError(f"Unsupported language: {language}")
        
        # Set ideal length range based on proficiency
        self.min_length, self.max_length = IDEAL_LENGTH_RANGE.get(
            self.proficiency, IDEAL_LENGTH_RANGE['intermediate']
        )
    
    def score_sentence(self, sentence: str, target_phrase: str, tokenized_sentence: Optional[List[str]] = None) -> Dict[str, float]:
        """
        Score a sentence using GDEX criteria.
        
        Args:
            sentence: The sentence text
            target_phrase: The target word or phrase
            tokenized_sentence: Optional pre-tokenized sentence
        
        Returns:
            Dictionary with individual scores and total score
        """
        # Normalize sentence and target phrase
        sentence = sentence.strip()
        target_phrase = target_phrase.lower()
        
        # Tokenize if not already tokenized
        if tokenized_sentence is None:
            tokenized_sentence = self._tokenize(sentence)
        
        # Calculate individual scores
        length_score = self._score_length(tokenized_sentence)
        target_position_score = self._score_target_position(sentence, target_phrase)
        common_words_score = self._score_common_words(tokenized_sentence)
        avoid_words_score = self._score_avoid_words(tokenized_sentence)
        pronouns_score = self._score_pronouns(tokenized_sentence)
        syntactic_score = self._score_syntactic_completeness(sentence)
        
        # Combine scores with weights
        scores = {
            'length': length_score,
            'target_position': target_position_score,
            'common_words': common_words_score,
            'avoid_words': avoid_words_score,
            'pronouns': pronouns_score,
            'syntactic': syntactic_score
        }
        
        # Apply weights based on proficiency level
        if self.proficiency == 'beginner':
            weights = {
                'length': 0.25,            # Shorter sentences are important for beginners
                'target_position': 0.15,   # Clear target word position helps beginners
                'common_words': 0.30,      # Using common words is crucial for beginners
                'avoid_words': 0.15,       # Avoiding problematic content
                'pronouns': 0.10,          # Clear references help beginners
                'syntactic': 0.05          # Simple syntax is better for beginners
            }
        elif self.proficiency == 'advanced':
            weights = {
                'length': 0.15,            # Length less important for advanced learners
                'target_position': 0.15,   # Position still matters
                'common_words': 0.15,      # Can handle less common words
                'avoid_words': 0.15,       # Still avoid problematic content
                'pronouns': 0.15,          # Can handle more complex references
                'syntactic': 0.25          # Can handle more complex syntax
            }
        else:  # intermediate
            weights = {
                'length': 0.20,            # Balanced for intermediate learners
                'target_position': 0.15,   # Position is important
                'common_words': 0.25,      # Vocabulary is important but can handle some uncommon words
                'avoid_words': 0.15,       # Avoid problematic content
                'pronouns': 0.10,          # Can handle some pronouns
                'syntactic': 0.15          # Can handle moderate syntax complexity
            }
        
        # Calculate weighted total score
        total_score = sum(scores[key] * weights[key] for key in scores)
        
        # Add total score to the result
        scores['total'] = total_score
        
        return scores
    
    def _tokenize(self, text: str) -> List[str]:
        """
        Tokenize text into words.
        
        Args:
            text: Text to tokenize
            
        Returns:
            List of tokens
        """
        # Simple tokenization by splitting on whitespace and punctuation
        # For a production system, you'd use a proper tokenizer from spaCy or similar
        return [
            token.lower() for token in re.findall(r'\b\w+\b', text.lower())
        ]
    
    def _score_length(self, tokens: List[str]) -> float:
        """
        Score sentence based on its length.
        
        Args:
            tokens: Tokenized sentence
            
        Returns:
            Score from 0.0 to 1.0
        """
        token_count = len(tokens)
        
        # Check if within ideal range
        if self.min_length <= token_count <= self.max_length:
            # If within the ideal range, score based on proximity to the middle of the range
            mid_point = (self.min_length + self.max_length) / 2
            distance_from_mid = abs(token_count - mid_point)
            max_distance = (self.max_length - self.min_length) / 2
            
            # Convert to a score (closer to midpoint = higher score)
            return 1.0 - (distance_from_mid / max_distance) * 0.5  # Penalty is only up to 0.5
        elif token_count < self.min_length:
            # Too short
            return max(0.0, 0.5 * (token_count / self.min_length))
        else:
            # Too long
            if token_count > MAX_LENGTH:
                return 0.0  # Extremely long sentences get zero
            
            # Gradually decrease score as length exceeds max_length
            return max(0.0, 0.5 * (1.0 - (token_count - self.max_length) / (MAX_LENGTH - self.max_length)))
    
    def _score_target_position(self, sentence: str, target_phrase: str) -> float:
        """
        Score sentence based on the position and proximity of target phrase tokens.
        Scores higher when all tokens appear in correct order with minimal gaps.
        
        Args:
            sentence: The full sentence
            target_phrase: The target word or phrase
            
        Returns:
            Score from 0.0 to 1.0
        """
        sentence_lower = sentence.lower()
        target_tokens = target_phrase.lower().split()
        
        # Handle single word case
        if len(target_tokens) == 1:
            target_word = target_tokens[0]
            if target_word not in sentence_lower:
                return 0.0
            
            # Find position and score based on sentence position
            start_idx = sentence_lower.find(target_word)
            position_ratio = start_idx / len(sentence_lower)
            
            # Prefer words in the middle (around 0.3-0.7 of the way through)
            if 0.3 <= position_ratio <= 0.7:
                return 1.0
            elif position_ratio < 0.3:
                return 0.5 + (position_ratio / 0.3) * 0.5
            else:
                return 0.5 + ((1.0 - position_ratio) / 0.3) * 0.5
        
        # Multi-word phrase handling
        # First, check for exact phrase match (highest score)
        if target_phrase.lower() in sentence_lower:
            start_idx = sentence_lower.find(target_phrase.lower())
            position_ratio = start_idx / len(sentence_lower)
            
            # Exact match gets high score, with bonus for good position
            if 0.2 <= position_ratio <= 0.8:
                return 1.0
            else:
                return 0.9
        
        # If no exact match, look for tokens in order with minimal gaps
        sentence_tokens = self._tokenize(sentence)
        
        # Find the first occurrence of each target token in the sentence
        token_positions = []
        for target_token in target_tokens:
            found_position = None
            for i, sent_token in enumerate(sentence_tokens):
                if target_token == sent_token or target_token in sent_token:
                    found_position = i
                    break
            
            if found_position is None:
                # Token not found, return low score
                return 0.1
            
            token_positions.append(found_position)
        
        # Check if tokens appear in correct order
        if token_positions != sorted(token_positions):
            # Tokens are not in order, penalize heavily
            return 0.2
        
        # Calculate gap between consecutive tokens
        total_gap = 0
        for i in range(len(token_positions) - 1):
            gap = token_positions[i + 1] - token_positions[i] - 1
            total_gap += gap
        
        # Score based on total gap size
        if total_gap == 0:
            # All tokens are consecutive (perfect)
            gap_score = 1.0
        elif total_gap == 1:
            # One word between tokens (very good)
            gap_score = 0.9
        elif total_gap <= 3:
            # Few words between tokens (good)
            gap_score = 0.8
        elif total_gap <= 6:
            # Some words between tokens (acceptable)
            gap_score = 0.6
        elif total_gap <= 10:
            # Many words between tokens (poor)
            gap_score = 0.4
        else:
            # Tokens are very far apart (very poor)
            gap_score = 0.2
        
        # Consider position of the phrase in the sentence
        phrase_start_pos = token_positions[0]
        phrase_end_pos = token_positions[-1]
        phrase_center = (phrase_start_pos + phrase_end_pos) / 2
        
        # Normalize position to 0-1 range
        sentence_length = len(sentence_tokens)
        if sentence_length > 1:
            position_ratio = phrase_center / (sentence_length - 1)
        else:
            position_ratio = 0.5
        
        # Position score (prefer middle positions)
        if 0.2 <= position_ratio <= 0.8:
            position_score = 1.0
        elif position_ratio < 0.2:
            position_score = 0.7 + (position_ratio / 0.2) * 0.3
        else:
            position_score = 0.7 + ((1.0 - position_ratio) / 0.2) * 0.3
        
        # Combine gap score (70%) and position score (30%)
        final_score = gap_score * 0.7 + position_score * 0.3
        
        return min(1.0, final_score)
    
    def _score_common_words(self, tokens: List[str]) -> float:
        """
        Score sentence based on ratio of common words.
        
        Args:
            tokens: Tokenized sentence
            
        Returns:
            Score from 0.0 to 1.0
        """
        if not tokens:
            return 0.0
            
        # Count common words
        common_count = sum(1 for token in tokens if token in self.common_words)
        
        # Calculate ratio
        common_ratio = common_count / len(tokens)
        
        # Ideal ratio depends on proficiency
        if self.proficiency == 'beginner':
            ideal_ratio = 0.9  # Beginners need mostly common words
        elif self.proficiency == 'intermediate':
            ideal_ratio = 0.8  # Intermediate can handle more uncommon words
        else:  # advanced
            ideal_ratio = 0.7  # Advanced can handle even more uncommon words
        
        # Calculate score based on proximity to ideal ratio
        if common_ratio >= ideal_ratio:
            return 1.0
        else:
            return common_ratio / ideal_ratio
    
    def _score_avoid_words(self, tokens: List[str]) -> float:
        """
        Score sentence based on absence of words to avoid.
        
        Args:
            tokens: Tokenized sentence
            
        Returns:
            Score from 0.0 to 1.0 (0.0 if any avoid words are present)
        """
        for token in tokens:
            if token in self.avoid_words:
                return 0.0
        
        return 1.0
    
    def _score_pronouns(self, tokens: List[str]) -> float:
        """
        Score sentence based on absence of pronouns without clear referents.
        
        Args:
            tokens: Tokenized sentence
            
        Returns:
            Score from 0.0 to 1.0
        """
        if not tokens:
            return 0.0
            
        # Simple heuristic: check if sentence starts with a pronoun
        if tokens[0] in self.pronouns:
            return 0.5  # Penalize sentences starting with pronouns
        
        # Count pronouns
        pronoun_count = sum(1 for token in tokens if token in self.pronouns)
        
        # Calculate ratio
        pronoun_ratio = pronoun_count / len(tokens)
        
        # Penalize high pronoun ratios
        if pronoun_ratio > 0.3:  # More than 30% pronouns is bad
            return 0.5
        elif pronoun_ratio > 0.2:  # 20-30% pronouns is not ideal
            return 0.75
        else:
            return 1.0
    
    def _score_syntactic_completeness(self, sentence: str) -> float:
        """
        Score sentence based on syntactic completeness.
        
        Args:
            sentence: The sentence text
            
        Returns:
            Score from 0.0 to 1.0
        """
        # Without full parsing, use simple heuristics
        
        # Check for proper capitalization and ending punctuation
        if not sentence:
            return 0.0
            
        first_char = sentence[0]
        last_char = sentence[-1]
        
        # Should start with uppercase letter
        starts_with_uppercase = first_char.isupper()
        
        # Should end with proper punctuation
        ends_with_punctuation = last_char in ('.', '?', '!')
        
        # Check for multiple sentences
        sentence_markers = re.findall(r'[.!?]', sentence)
        is_single_sentence = len(sentence_markers) <= 1
        
        # Calculate score
        score = 1.0
        
        if not starts_with_uppercase:
            score -= 0.3
            
        if not ends_with_punctuation:
            score -= 0.3
            
        if not is_single_sentence:
            score -= 0.4
            
        return max(0.0, score)