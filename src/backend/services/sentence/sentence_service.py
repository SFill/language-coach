from fastapi import HTTPException
from sqlmodel import Session
from typing import List, Dict, Any, Optional
from pathlib import Path
import logging
import os

# Import the SentenceRetriever
from .sentence_retriever import SentenceRetriever

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

CURRENT_PATH = Path('.').absolute()

# Determine database path from environment or use default
DB_PATH = os.environ.get("SENTENCE_DB_PATH", CURRENT_PATH / "database.db")


# Create a singleton instance of SentenceRetriever
_sentence_retriever: Optional[SentenceRetriever] = None

def get_sentence_retriever(proficiency: str = "intermediate") -> SentenceRetriever:
    """
    Get or create a singleton instance of SentenceRetriever.
    
    Args:
        proficiency: User proficiency level ("beginner", "intermediate", "advanced")
        
    Returns:
        SentenceRetriever instance
    """
    global _sentence_retriever
    
    if _sentence_retriever is None:
        # Check if database exists
        if not Path(DB_PATH).exists():
            logger.error(f"Database file not found: {DB_PATH}, current path is {CURRENT_PATH}")
            raise HTTPException(
                status_code=500, 
                detail="Sentence database not found. Please check your configuration."
            )
        
        # Initialize the retriever
        try:
            _sentence_retriever = SentenceRetriever(DB_PATH, user_proficiency=proficiency)
        except Exception as e:
            logger.error(f"Error initializing SentenceRetriever: {str(e)}")
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to initialize sentence retriever: {str(e)}"
            )
    
    return _sentence_retriever

def search_for_sentences(
    session: Session, 
    word: str, 
    language: str = "en", 
    top_n: int = 5,
    proficiency: str = "intermediate"
) -> List[Dict[str, Any]]:
    """
    Search for sentences containing a specific word using the GDEX-based retriever.
    
    Args:
        session: Database session (not used with SentenceRetriever but kept for API compatibility)
        word: The word or phrase to search for
        language: ISO language code (e.g., 'en', 'es')
        top_n: Number of top examples to return
        proficiency: User proficiency level
        
    Returns:
        List of dictionaries with sentence examples and metadata
    """
    try:
        # Get or initialize the sentence retriever
        retriever = get_sentence_retriever(proficiency)
        
        # Get the best examples
        examples = retriever.get_best_examples(
            phrase=word,
            language=language,
            top_n=top_n,
            use_gdex=True
        )
        
        # Format the results
        formatted_results = []
        for ex in examples:
            formatted_results.append({
                "id": str(ex.get("text_id", "")),
                "sentence": ex["sentence"],
                "score": ex["score"],
                "title": ex.get("title", "Unknown"),
                "category": ex.get("category", "Unknown"),
                # We don't have token metadata like in the original implementation,
                # so we'll provide an empty list for compatibility
                "meta": []
            })
        
        return formatted_results
        
    except Exception as e:
        logger.error(f"Error searching for sentences: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error searching for sentences: {str(e)}"
        )