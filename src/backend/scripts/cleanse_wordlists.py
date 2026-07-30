"""One-off migration: drop corrupted word translations and add id + version.

The wordlist edit bug stored Python `repr()` of whole word objects in
`word_translation` (compounding into nested escape-hell over many edits). The
`word` and `example_phrase` fields are intact, so translations can be
regenerated cleanly. This script:

  * nulls `word_translation` and `example_phrase_translation` for every word,
  * sets `version = 0` (the frontend bumps it on edit; a missing/0 version
    with null translations forces the backend to retranslate on the next sync),
  * adds a stable `id` (uuid) to any word missing one.

Run once from the repo root:
    PYTHONPATH=src python src/backend/scripts/cleanse_wordlists.py
"""
import uuid

from sqlmodel import Session, select

from backend.database import engine
from backend.models.wordlist import Wordlist


def cleanse_word(word: dict) -> dict:
    return {
        **word,
        "id": word.get("id") or str(uuid.uuid4()),
        "version": 0,
        "word_translation": None,
        "example_phrase_translation": None,
    }


def main() -> None:
    with Session(engine) as session:
        wordlists = session.exec(select(Wordlist)).all()
        changed = 0
        for wl in wordlists:
            words = wl.words or []
            new_words = [cleanse_word(w) for w in words]
            if new_words != words:
                wl.words = new_words
                changed += 1
        session.commit()
        print(f"Cleansed {changed} wordlists ({sum(len(wl.words or []) for wl in wordlists)} words total).")


if __name__ == "__main__":
    main()