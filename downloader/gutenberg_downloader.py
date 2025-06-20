#!/usr/bin/env python3
"""
Gutenberg Book Downloader with spaCy POS Tagging

This script downloads books from Project Gutenberg by category using the Gutendex API,
parses the text, and performs POS tagging using spaCy.
"""

import os
import json
import re
import asyncio
import logging
from typing import Dict, List, Optional, Set, Tuple, Union, Any
from pathlib import Path
from dataclasses import dataclass
from urllib.parse import quote

import aiohttp
import aiofiles
import spacy
from spacy.tokens import Doc
from pydantic import BaseModel, Field


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Pydantic models for data validation
class GutendexBook(BaseModel):
    """Model for book data from Gutendex API"""
    id: int
    title: str
    authors: List[Dict[str, Any]]
    languages: List[str]
    download_count: int
    formats: Dict[str, str] = Field(default_factory=dict)
    subjects: List[str] = Field(default_factory=list)


class ProcessedWord(BaseModel):
    """Model for processed words with POS tagging"""
    text: str
    lemma: str
    pos: str
    tag: str
    is_stop: bool = False
    is_punct: bool = False
    ent_type: str = ""


class ProcessedSentence(BaseModel):
    """Model for processed sentences"""
    text: str
    words: List[ProcessedWord]


class ProcessedBook(BaseModel):
    """Model for a processed book"""
    id: int
    title: str
    author: str
    language: str
    sentences: List[ProcessedSentence]
    category: str


# Constants
GUTENDEX_API_URL = "https://gutendex.com/books"
PLAIN_TEXT_MIME = "text/plain"
UTF8_PREFERRED = "utf-8"

# Categories to search for
CATEGORIES = {
    "business": ["Business","Business/Management", "commerce", "trade", "economics"],
    "travel": ["travel", "journey", "voyage", "guide"],
    "fantasy": ["fantasy", "fiction"],
    "conversation": ["dialogue", "conversation", "letters", "Language & Communication"],
    "news": ["newspaper", "journalism", "reporter", "press"]
}

# Languages to include
LANGUAGES = ["en", "es"]

# Output directories
OUTPUT_DIR = Path("downloader/gutenberg_data")
RAW_BOOKS_DIR = OUTPUT_DIR / "raw"
PROCESSED_BOOKS_DIR = OUTPUT_DIR / "processed"


async def setup_directories() -> None:
    """Create necessary directories for storing books and processed data."""
    dirs = [RAW_BOOKS_DIR, PROCESSED_BOOKS_DIR]
    
    for directory in dirs:
        directory.mkdir(parents=True, exist_ok=True)
        
    logger.info("Directories created successfully")


async def search_books_by_category(
    session: aiohttp.ClientSession, 
    category: str, 
    language: str, 
    max_books: int = 5
) -> List[GutendexBook]:
    """
    Search for books by category and language using Gutendex API.
    
    Args:
        session: aiohttp client session
        category: Category to search for
        language: Language code (e.g., 'en' for English)
        max_books: Maximum number of books to fetch
        
    Returns:
        List of books matching the criteria
    """
    search_terms = CATEGORIES.get(category, [category])
    books: List[GutendexBook] = []
    
    for term in search_terms:
        if len(books) >= max_books:
            break
            
        # URL encode the search term
        encoded_term = quote(term)
        search_url = f"{GUTENDEX_API_URL}?topic={encoded_term}&languages={language}&sort=popular"
        
        try:
            async with session.get(search_url) as response:
                if response.status != 200:
                    logger.error(f"Error fetching books for term '{term}': HTTP {response.status}")
                    continue
                    
                data = await response.json()
                
                # Check if we got results and add them to our list
                if "results" in data and data["results"]:
                    for book_data in data["results"]:
                        # Skip books we already have enough or those without text formats
                        if len(books) >= max_books:
                            break
                            
                        # Create a GutendexBook from the data
                        book = GutendexBook(**book_data)
                        
                        # Only add if we have plain text format available
                        has_text_format = any(PLAIN_TEXT_MIME in fmt for fmt in book.formats.keys())
                        if has_text_format:
                            books.append(book)
        
        except (aiohttp.ClientError, json.JSONDecodeError) as e:
            logger.error(f"Error searching for '{term}': {str(e)}")
    
    logger.info(f"Found {len(books)} books for category '{category}' in language '{language}'")
    return books


async def download_book(
    session: aiohttp.ClientSession, 
    book: GutendexBook,
    category: str
) -> Optional[Path]:
    """
    Download a book from Project Gutenberg.
    
    Args:
        session: aiohttp client session
        book: Book data from Gutendex API
        category: Category for organizing downloaded books
        
    Returns:
        Path to the downloaded book file, or None if download failed
    """
    # Get the best available text format URL
    text_format_url = None
    
    # Look for UTF-8 text format first
    for format_key, url in book.formats.items():
        if PLAIN_TEXT_MIME in format_key and UTF8_PREFERRED in format_key.lower():
            text_format_url = url
            break
    
    # If no UTF-8 format, use any plain text format
    if not text_format_url:
        for format_key, url in book.formats.items():
            if PLAIN_TEXT_MIME in format_key:
                text_format_url = url
                break
    
    if not text_format_url:
        logger.error(f"No text format found for book: {book.title} (ID: {book.id})")
        return None
    
    # Create a filename based on book ID and title
    safe_title = re.sub(r'[^\w\-]', '_', book.title[:50])
    lang = book.languages[0] if book.languages else "unknown"
    filename = f"{book.id}_{safe_title}.txt"
    
    # Create the category directory if it doesn't exist
    category_dir = RAW_BOOKS_DIR / category / lang
    category_dir.mkdir(parents=True, exist_ok=True)
    
    output_path = category_dir / filename
    
    # Download the book
    try:
        async with session.get(text_format_url) as response:
            if response.status != 200:
                logger.error(f"Error downloading book {book.id}: HTTP {response.status}")
                return None
                
            content = await response.text(errors='replace')
            
            # Save the book content to a file
            async with aiofiles.open(output_path, 'w', encoding='utf-8') as f:
                await f.write(content)
                
        logger.info(f"Downloaded book: {book.title} (ID: {book.id}) to {output_path}")
        return output_path
        
    except (aiohttp.ClientError, IOError) as e:
        logger.error(f"Error downloading book {book.id}: {str(e)}")
        return None


def clean_gutenberg_text(text: str) -> str:
    """
    Clean the Project Gutenberg text by removing headers and footers.
    
    Args:
        text: Raw text from Project Gutenberg
        
    Returns:
        Cleaned text
    """
    # Find standard Project Gutenberg header/footer markers
    start_markers = [
        "*** START OF THIS PROJECT GUTENBERG EBOOK",
        "*** START OF THE PROJECT GUTENBERG EBOOK",
        "*END*THE SMALL PRINT",
        "*** START OF THE PROJECT GUTENBERG",
        "***START OF THE PROJECT GUTENBERG",
        "This etext was prepared by",
        "E-text prepared by",
        "Produced by",
        "Distributed Proofreading Team",
        "Proofreading Team at http://www.pgdp.net",
        "http://gallica.bnf.fr)",
        "*END THE SMALL PRINT",
        "*** START OF THIS PROJECT",
        "Copyright laws are changing",
        "We are now trying to release all our eBooks one year",
        "Please take a look at the important information in this header",
        "This file was produced from images"
    ]
    
    end_markers = [
        "*** END OF THIS PROJECT GUTENBERG EBOOK",
        "*** END OF THE PROJECT GUTENBERG EBOOK",
        "End of Project Gutenberg's",
        "End of the Project Gutenberg EBook",
        "End of The Project Gutenberg EBook",
        "End of Project Gutenberg EBook",
        "End of this Project Gutenberg etext",
        "End of this Etext by",
        "End of this is COPYRIGHTED",
        "End of Project Gutenberg's EBook",
        "This file should be named",
        "This eBook was produced by",
        "This file was produced from images",
        "This etext was produced by",
        "This etext was prepared by",
        "This text was prepared by",
        "Prepared by",
        "End of the Project Gutenberg"
    ]
    
    # Find the start position
    start_pos = 0
    for marker in start_markers:
        marker_pos = text.find(marker)
        if marker_pos != -1:
            # Find the end of the line where the marker occurs
            line_end = text.find('\n', marker_pos)
            if line_end != -1:
                start_pos = line_end + 1
                break
    
    # Find the end position
    end_pos = len(text)
    for marker in end_markers:
        marker_pos = text.rfind(marker)
        if marker_pos != -1:
            # Find the start of the line where the marker occurs
            line_start = text.rfind('\n', 0, marker_pos)
            if line_start != -1:
                end_pos = line_start
                break
    
    # Extract the text between the start and end positions
    cleaned_text = text[start_pos:end_pos].strip()
    
    # Remove empty lines and normalize whitespace
    cleaned_text = re.sub(r'\n{3,}', '\n\n', cleaned_text)
    
    return cleaned_text


async def process_book_with_spacy(
    file_path: Path,
    category: str,
    language: str,
    nlp_model: spacy.language.Language
) -> Optional[ProcessedBook]:
    """
    Process a book with spaCy for POS tagging.
    
    Args:
        file_path: Path to the book file
        category: Book category
        language: Book language (ISO code)
        nlp_model: Loaded spaCy model
        
    Returns:
        ProcessedBook object or None if processing failed
    """
    try:
        # Extract book ID and title from filename
        filename = file_path.name
        book_id = int(filename.split('_')[0])
        title = ' '.join(filename.split('_')[1:-1]).replace('_', ' ')
        
        # Read the book content
        async with aiofiles.open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            content = await f.read()
            
        # Clean the text
        cleaned_content = clean_gutenberg_text(content)
        
        # Check if the text is too large for spaCy
        MAX_CHUNK_SIZE = 900000  # Slightly below spaCy's default max_length of 1,000,000
        
        # Extract sentences and words with POS tagging
        sentences = []
        
        # If the text is too large, process it in chunks
        if len(cleaned_content) > MAX_CHUNK_SIZE:
            logger.info(f"Text is large ({len(cleaned_content)} chars). Processing in chunks...")
            
            # Split the text into smaller chunks at paragraph boundaries
            chunks = []
            current_chunk = ""
            
            # Use paragraphs as natural splitting points
            paragraphs = cleaned_content.split('\n\n')
            
            for paragraph in paragraphs:
                if len(current_chunk) + len(paragraph) + 2 <= MAX_CHUNK_SIZE:
                    current_chunk += paragraph + '\n\n'
                else:
                    # Save the current chunk and start a new one
                    chunks.append(current_chunk)
                    current_chunk = paragraph + '\n\n'
            
            # Add the last chunk if it's not empty
            if current_chunk:
                chunks.append(current_chunk)
                
            logger.info(f"Split text into {len(chunks)} chunks")
            
            # Process each chunk
            for i, chunk in enumerate(chunks):
                logger.info(f"Processing chunk {i+1}/{len(chunks)}")
                doc = nlp_model(chunk)
                
                # Extract sentences from this chunk
                for sent in doc.sents:
                    words = []
                    for token in sent:
                        word = ProcessedWord(
                            text=token.text,
                            lemma=token.lemma_,
                            pos=token.pos_,
                            tag=token.tag_,
                            is_stop=token.is_stop,
                            is_punct=token.is_punct,
                            ent_type=token.ent_type_ if token.ent_type_ else ""
                        )
                        words.append(word)
                        
                    if words:  # Only add if the sentence has valid words
                        sentence = ProcessedSentence(
                            text=sent.text,
                            words=words
                        )
                        sentences.append(sentence)
        else:
            # Process normally for smaller texts
            doc = nlp_model(cleaned_content)
            
            for sent in doc.sents:
                words = []
                for token in sent:
                    word = ProcessedWord(
                        text=token.text,
                        lemma=token.lemma_,
                        pos=token.pos_,
                        tag=token.tag_,
                        is_stop=token.is_stop,
                        is_punct=token.is_punct,
                        ent_type=token.ent_type_ if token.ent_type_ else ""
                    )
                    words.append(word)
                    
                if words:  # Only add if the sentence has valid words
                    sentence = ProcessedSentence(
                        text=sent.text,
                        words=words
                    )
                    sentences.append(sentence)
        
        # Determine the author name (using empty string if not available)
        filename_parts = filename.split('_')
        author = "Unknown Author"  # Default
        
        # Create the ProcessedBook object
        processed_book = ProcessedBook(
            id=book_id,
            title=title,
            author=author,
            language=language,
            sentences=sentences,
            category=category
        )
        
        return processed_book
        
    except Exception as e:
        logger.error(f"Error processing book {file_path}: {str(e)}")
        return None


async def save_processed_book(processed_book: ProcessedBook) -> Path:
    """
    Save a processed book to JSON.
    
    Args:
        processed_book: ProcessedBook object
        
    Returns:
        Path to the saved JSON file
    """
    # Create a safe filename
    safe_title = re.sub(r'[^\w\-]', '_', processed_book.title[:50])
    filename = f"{processed_book.id}_{safe_title}.json"
    
    # Create the category directory if it doesn't exist
    category_dir = PROCESSED_BOOKS_DIR / processed_book.category / processed_book.language
    category_dir.mkdir(parents=True, exist_ok=True)
    
    output_path = category_dir / filename
    
    # Convert to JSON and save
    try:
        book_json = processed_book.model_dump_json(indent=2)
        async with aiofiles.open(output_path, 'w', encoding='utf-8') as f:
            await f.write(book_json)
            
        logger.info(f"Saved processed book: {processed_book.title} to {output_path}")
        return output_path
        
    except Exception as e:
        logger.error(f"Error saving processed book {processed_book.id}: {str(e)}")
        raise


async def process_book_file(
    file_path: Path,
    category: str,
    nlp_models: Dict[str, spacy.language.Language]
) -> Optional[Path]:
    """
    Process a single book file with spaCy.
    
    Args:
        file_path: Path to the book file
        category: Book category
        nlp_models: Dictionary of loaded spaCy models by language
        
    Returns:
        Path to the processed JSON file, or None if processing failed
    """
    # Determine the language from the directory structure
    language = file_path.parent.name
    
    # Make sure we have a model for this language
    if language not in nlp_models:
        logger.error(f"No spaCy model loaded for language: {language}")
        return None
    
    # Process the book
    processed_book = await process_book_with_spacy(file_path, category, language, nlp_models[language])
    
    if processed_book:
        # Save the processed book
        return await save_processed_book(processed_book)
    
    return None


async def main():
    """Main function to execute the script."""
    # Create directories
    await setup_directories()
    
    # Load spaCy models
    nlp_models = {}
    for lang in LANGUAGES:
        try:
            # Use the correct model name for each language
            if lang == "en":
                model_name = "en_core_web_sm"
            elif lang == "es":
                model_name = "es_core_news_sm"
            else:
                model_name = f"{lang}_core_web_sm"  # Fallback pattern
            nlp_models[lang] = spacy.load(model_name)
            logger.info(f"Loaded spaCy model for language: {lang}")
        except IOError:
            logger.error(f"Failed to load spaCy model for language: {lang}. "
                         f"Please install it with: python -m spacy download {lang}_core_web_sm")
            return
    
    # Create an aiohttp session
    async with aiohttp.ClientSession() as session:
        # For each category and language, search for books and download them
        for category in CATEGORIES:
            for language in LANGUAGES:
                logger.info(f"Searching for books in category: {category}, language: {language}")
                
                # Search for books in this category and language
                books = await search_books_by_category(session, category, language)
                
                # Download each book
                tasks = []
                for book in books:
                    tasks.append(
                        download_book(session, book, category)
                    )
                await asyncio.gather(*tasks)
    # Process all downloaded books
    logger.info("Processing downloaded books with spaCy...")
    
    for category_dir in RAW_BOOKS_DIR.iterdir():
        if category_dir.is_dir():
            category = category_dir.name
            
            for lang_dir in category_dir.iterdir():
                if lang_dir.is_dir():
                    for book_file in lang_dir.iterdir():
                        if book_file.is_file() and book_file.name.endswith('.txt'):
                            logger.info(f"Processing book: {book_file}")
                            await process_book_file(book_file, category, nlp_models)
    
    logger.info("Book processing completed successfully!")


if __name__ == "__main__":
    asyncio.run(main())