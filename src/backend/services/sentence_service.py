from fastapi import HTTPException
from sqlmodel import Session, select
from ..models.sentence import ReverseIndex, Sentence

def search_for_sentences(session: Session, word: str) -> list[Sentence]:
    """
    Search for sentences containing a specific word.
    """
    # Retrieve the sentences object
    reverse_index = session.exec(
        select(ReverseIndex).where(ReverseIndex.word == word)
    ).all()
    
    if not reverse_index:
        raise HTTPException(status_code=404, detail="word not found")

    sentence_ids = reverse_index[0].sentence_ids

    sentences = session.exec(
        select(Sentence).where(Sentence.id.in_(sentence_ids)).limit(1)
    ).all()

    return sentences