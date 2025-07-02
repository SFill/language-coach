from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session
from typing import List, Dict, Any

from ..database import get_session
from ..services.sentence.sentence_service import search_for_sentences

router = APIRouter(prefix="/api/coach/index", tags=["index"])

@router.get("/words/{word}", response_model=List[Dict[str, Any]])
async def get_sentences_for_word(
    word: str,
    language: str = Query("en", description="ISO language code (e.g., 'en', 'es')"),
    top_n: int = Query(5, description="Number of results to return"),
    proficiency: str = Query("intermediate", description="User proficiency level"),
    session: Session = Depends(get_session)
):
    """
    Get example sentences containing a specific word.
    
    Parameters:
    - word: The word to search for
    - language: ISO language code (e.g., 'en', 'es')
    - top_n: Number of results to return
    - proficiency: User proficiency level (beginner, intermediate, advanced)
    
    Returns:
    - List of sentences with metadata
    """
    try:
        sentences = search_for_sentences(
            session=session,
            word=word,
            language=language,
            top_n=top_n,
            proficiency=proficiency
        )
        
        if not sentences:
            raise HTTPException(status_code=404, detail="No sentences found for this word")
            
        return sentences
        
    except HTTPException as he:
        # Re-raise HTTP exceptions
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")