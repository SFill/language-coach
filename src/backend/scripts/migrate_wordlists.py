#!/usr/bin/env python3
"""
Migration script to convert old wordlist format to new WordInList format.

This script migrates wordlists from:
- Old DB format: words = ["word1", "word2", ...]
- New DB format: words = [{"word": "word1", "word_translation": "...", "example_phrase": "...", "example_phrase_translation": "..."}, ...]

Usage:
    python migrate_wordlists.py [--dry-run] [--use-gpt-translation]
"""

import sys
import os
import argparse
import logging
from pathlib import Path
from typing import List, Dict, Any
import json

# Add the parent directory to the Python path so we can import from the backend
sys.path.append(str(Path(__file__).parent.parent))

from sqlmodel import create_engine, Session, select, text
from ..services.phrase_service import get_phrase_with_example_and_translation

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def is_old_format(words_json: str) -> bool:
    """Check if the wordlist is in old format (list of strings)."""
    try:
        words = json.loads(words_json)
        if not words:
            return False
        # Check if first item is a string (old format) vs dict (new format)
        return isinstance(words[0], str)
    except (json.JSONDecodeError, IndexError, TypeError):
        return False


def migrate_wordlist_data(
    wordlist_id: int,
    wordlist_name: str,
    words_json: str, 
    language: str,
    session: Session, 
    use_gpt_translation: bool = False,
    dry_run: bool = False
) -> bool:
    """
    Migrate a single wordlist's words from old format to new format.
    
    Args:
        wordlist_id: ID of the wordlist
        wordlist_name: Name of the wordlist  
        words_json: JSON string of words
        language: Language of the wordlist
        session: Database session
        use_gpt_translation: Whether to use GPT for translation
        dry_run: If True, don't save changes to database
        
    Returns:
        True if migration was needed and successful, False otherwise
    """
    
    try:
        words = json.loads(words_json)
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON in wordlist '{wordlist_name}' (ID: {wordlist_id})")
        return False
    
    if not is_old_format(words_json):
        logger.info(f"Wordlist '{wordlist_name}' (ID: {wordlist_id}) is already in new format")
        return False
    
    logger.info(f"Migrating wordlist '{wordlist_name}' (ID: {wordlist_id}) with {len(words)} words")
    
    new_words = []
    
    for i, word_str in enumerate(words):
        try:
            logger.info(f"  Processing word {i+1}/{len(words)}: '{word_str}'")
            
            # Get word with translation and example
            word_data = get_phrase_with_example_and_translation(
                phrase=word_str,
                language=language,
                target_language="en",
                proficiency="intermediate",
                session=session,
                use_gpt_translation=use_gpt_translation
            )
            
            # Create word object in new format
            word_dict = {
                "word": word_data["word"],
                "word_translation": word_data["word_translation"],
                "example_phrase": word_data["example_phrase"],
                "example_phrase_translation": word_data["example_phrase_translation"]
            }
            
            new_words.append(word_dict)
            
            logger.info(f"    ✓ {word_str} -> {word_data['word_translation']}")
            
        except Exception as e:
            logger.error(f"    ✗ Failed to process word '{word_str}': {str(e)}")
            # Add a basic word object as fallback
            new_words.append({
                "word": word_str,
                "word_translation": None,
                "example_phrase": None,
                "example_phrase_translation": None
            })
    
    if not dry_run:
        # Update the wordlist with new format using raw SQL
        new_words_json = json.dumps(new_words)
        update_query = text("""
            UPDATE wordlist 
            SET words = :new_words 
            WHERE id = :wordlist_id
        """)
        
        session.execute(update_query, {
            "new_words": new_words_json,
            "wordlist_id": wordlist_id
        })
        session.commit()
        logger.info(f"✓ Migrated wordlist '{wordlist_name}' successfully")
    else:
        logger.info(f"✓ Would migrate wordlist '{wordlist_name}' (dry run mode)")
    
    return True


def main():
    parser = argparse.ArgumentParser(description="Migrate wordlists from old format to new WordInList format")
    parser.add_argument(
        "--dry-run", 
        action="store_true", 
        help="Show what would be migrated without making changes"
    )
    parser.add_argument(
        "--use-gpt-translation", 
        action="store_true", 
        help="Use GPT for translation instead of Google Translate"
    )
    parser.add_argument(
        "--language", 
        choices=["en", "es"], 
        help="Only migrate wordlists for specific language"
    )
    parser.add_argument(
        "--wordlist-id", 
        type=int, 
        help="Only migrate specific wordlist by ID"
    )
    
    args = parser.parse_args()
    
    # Create database engine
    database_url = f"sqlite:///database.db"
    engine = create_engine(database_url)
    
    logger.info("Starting wordlist migration...")
    if args.dry_run:
        logger.info("🔍 DRY RUN MODE - No changes will be made")
    
    migrated_count = 0
    total_count = 0
    
    with Session(engine) as session:
        # Build query based on arguments
        where_clauses = []
        params = {}
        
        if args.language:
            where_clauses.append("language = :language")
            params["language"] = args.language
            logger.info(f"Filtering by language: {args.language}")
        
        if args.wordlist_id:
            where_clauses.append("id = :wordlist_id")
            params["wordlist_id"] = args.wordlist_id
            logger.info(f"Filtering by wordlist ID: {args.wordlist_id}")
        
        where_clause = ""
        if where_clauses:
            where_clause = "WHERE " + " AND ".join(where_clauses)
        
        # Get wordlists using raw SQL to avoid Pydantic validation issues
        query = text(f"""
            SELECT id, name, words, language 
            FROM wordlist 
            {where_clause}
        """)
        
        result = session.execute(query, params)
        wordlists = result.fetchall()
        total_count = len(wordlists)
        
        logger.info(f"Found {total_count} wordlists to check")
        
        for row in wordlists:
            wordlist_id, wordlist_name, words_json, language = row
            try:
                if migrate_wordlist_data(
                    wordlist_id=wordlist_id,
                    wordlist_name=wordlist_name,
                    words_json=words_json,
                    language=language,
                    session=session,
                    use_gpt_translation=args.use_gpt_translation,
                    dry_run=args.dry_run
                ):
                    migrated_count += 1
            except Exception as e:
                logger.error(f"Failed to migrate wordlist '{wordlist_name}' (ID: {wordlist_id}): {str(e)}")
    
    logger.info(f"\n📊 Migration Summary:")
    logger.info(f"   Total wordlists checked: {total_count}")
    logger.info(f"   Wordlists migrated: {migrated_count}")
    logger.info(f"   Already in new format: {total_count - migrated_count}")
    
    if args.dry_run:
        logger.info(f"\n🔍 This was a dry run. Run without --dry-run to perform actual migration.")
    else:
        logger.info(f"\n✅ Migration completed successfully!")


if __name__ == "__main__":
    main()