#!/usr/bin/env python3
"""
Database Integration for Gutenberg Processed Books

This script imports processed Gutenberg books into the Language Coach SQLite database.
"""

import os
import json
import logging
import pickle
from pathlib import Path
from typing import Dict, List, Optional, Any
import argparse

import spacy
from sqlmodel import SQLModel, Session, create_engine, select

# Import database models
from ..services.sentence.db_models import Text, Phrase, Word


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Constants
DEFAULT_DB_PATH = "database.db"
DEFAULT_PROCESSED_BOOKS_DIR = Path("data/gutenberg_data/processed")
INDEX_DIR = Path("data/gutenberg_data/indexes")


def create_db_engine(db_path: str):
    """Create SQLModel engine with SQLite connection."""
    # Create SQLite URL (file path with sqlite:/// prefix)
    sqlite_url = f"sqlite:///{db_path}"
    
    # Create engine
    engine = create_engine(sqlite_url, echo=False)
    
    # Create tables if they don't exist
    SQLModel.metadata.create_all(engine)
    
    return engine


def import_book_to_database(session: Session, book_path: Path) -> bool:
    """
    Import a processed book JSON file into the database with optimized bulk inserts.
    
    Args:
        session: SQLModel database session
        book_path: Path to the processed book JSON file
        
    Returns:
        True if import was successful, False otherwise
    """
    try:
        # Read the JSON file
        with open(book_path, 'r', encoding='utf-8') as f:
            book_data = json.load(f)
        
        # Check if book already exists in database
        existing_book = session.exec(
            select(Text).where(Text.source == f"gutenberg_{book_data.get('id')}")
        ).first()
        
        if existing_book:
            logger.info(f"Book {book_data.get('title')} (ID: {book_data.get('id')}) already exists in database")
            return True
        
        # Step 1: Create the text entry
        text_entry = Text(
            title=book_data.get("title", "Unknown Title"),
            language=book_data.get("language", "unknown"),
            source=f"gutenberg_{book_data.get('id')}",
            category=book_data.get("category", "unknown")
        )
        session.add(text_entry)
        session.flush()  # Flush to get the ID
        text_id = text_entry.id
        
        # Step 2: Prepare all phrases at once
        phrases = []
        for sentence in book_data.get("sentences", []):
            phrase = Phrase(
                text=sentence["text"],
                language=book_data.get("language", "unknown"),
                text_id=text_id
            )
            phrases.append((phrase, sentence.get("words", [])))
        
        # Add all phrases
        phrase_entries = [p[0] for p in phrases]
        session.add_all(phrase_entries)
        session.flush()  # Flush to get IDs
        
        # Step 3: Prepare all words at once
        words = []
        for phrase_entry, phrase_words in zip(phrase_entries, [p[1] for p in phrases]):
            for word in phrase_words:
                word_entry = Word(
                    text=word.get("text", ""),
                    lemma=word.get("lemma", ""),
                    pos=word.get("pos", ""),
                    tag=word.get("tag", ""),
                    is_stop=word.get("is_stop", False),
                    is_punct=word.get("is_punct", False),
                    ent_type=word.get("ent_type", ""),
                    phrase_id=phrase_entry.id,
                    text_id=text_id
                )
                words.append(word_entry)
        
        # Add all words at once
        if words:
            session.add_all(words)
        
        session.commit()
        logger.info(f"Imported book {book_data.get('title')} (ID: {book_data.get('id')}) into database with bulk inserts")
        return True
        
    except Exception as e:
        logger.exception(f"Error importing book {book_path}: {str(e)}")
        session.rollback()
        return False


def import_all_books(db_path: str, processed_books_dir: Path) -> None:
    """
    Import all processed books into the database with batch processing.
    
    Args:
        db_path: Path to the SQLite database file
        processed_books_dir: Directory containing processed book JSON files
    """
    # Create the engine and session
    engine = create_db_engine(db_path)
    
    try:
        # Track import statistics
        total_books = 0
        successful_imports = 0
        
        # Process all categories in batches
        for category_dir in processed_books_dir.iterdir():
            if category_dir.is_dir():
                logger.info(f"Processing category: {category_dir.name}")
                
                # Process all languages in this category
                for lang_dir in category_dir.iterdir():
                    if lang_dir.is_dir():
                        logger.info(f"Processing language: {lang_dir.name} in category: {category_dir.name}")
                        
                        # Get all book files in this directory
                        book_files = [f for f in lang_dir.iterdir() if f.is_file() and f.suffix == '.json']
                        total_books += len(book_files)
                        
                        # Process in batches of 10 books at a time to avoid memory issues
                        batch_size = 10
                        for i in range(0, len(book_files), batch_size):
                            batch = book_files[i:i+batch_size]
                            
                            with Session(engine) as session:
                                for book_file in batch:
                                    if import_book_to_database(session, book_file):
                                        successful_imports += 1
        
        logger.info(f"Import complete. Successfully imported {successful_imports} out of {total_books} books.")
        
        # After importing books, build the gdex index
        logger.info("Building gdex index after import...")
        build_gdex_index(db_path)
        
    except Exception as e:
        logger.error(f"Error during book import: {str(e)}")


def build_gdex_index(db_path: str) -> None:
    """
    Build gdex index for all languages after importing books.
    
    Args:
        db_path: Path to the SQLite database file
    """
    from ..services.sentence.sentence_retriever import SentenceRetriever
    
    # Create directory for indexes if it doesn't exist
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    
    # Initialize the retriever
    retriever = SentenceRetriever(db_path)
    
    # Build indexes for supported languages
    for language in ["en", "es"]:
        try:
            # Load spaCy model
            if language == "en":
                nlp = spacy.load("en_core_web_sm", disable=["parser", "ner"])
            else:
                nlp = spacy.load("es_core_news_sm", disable=["parser", "ner"])
                
            # Build the index and save
            logger.info(f"Building Gdex index for language: {language}")
            retriever.build_sentence_index(language)
            
        except Exception as e:
            logger.error(f"Error building Gdex index for {language}: {str(e)}")


def main():
    """Main function to parse arguments and execute the script."""
    parser = argparse.ArgumentParser(description="Import processed Gutenberg books into the Language Coach database")
    parser.add_argument(
        "--db-path", 
        type=str, 
        default=DEFAULT_DB_PATH,
        help=f"Path to the SQLite database file (default: {DEFAULT_DB_PATH})"
    )
    parser.add_argument(
        "--books-dir", 
        type=str, 
        default=str(DEFAULT_PROCESSED_BOOKS_DIR),
        help=f"Directory containing processed book files (default: {DEFAULT_PROCESSED_BOOKS_DIR})"
    )
    
    args = parser.parse_args()
    
    # Convert books_dir to Path object
    books_dir = Path(args.books_dir)
    
    if not books_dir.exists() or not books_dir.is_dir():
        logger.error(f"Processed books directory not found: {books_dir}")
        return
    
    # Import all books
    import_all_books(args.db_path, books_dir)


if __name__ == "__main__":
    main()