"""
Shared test fixtures for the backend test suite.

This file contains reusable pytest fixtures that can be used across multiple test files.
These fixtures follow the refactoring pattern of using real database sessions and objects
while only mocking external dependencies.
"""

import pytest
import tempfile
import shutil
from pathlib import Path
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

from backend.models.chat import Chat
from backend.models.dict_english import Dictionary
from backend.models.dict_spanish import SpanishDictionary
from backend.services.sentence.db_models import Text, Phrase, Word


@pytest.fixture
def test_engine():
    """Create a test database engine with in-memory SQLite."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture
def test_session(test_engine):
    """Create a test database session."""
    with Session(test_engine) as session:
        yield session


@pytest.fixture
def temp_directory():
    """Create a temporary directory for test files."""
    temp_dir = tempfile.mkdtemp()
    yield Path(temp_dir)
    shutil.rmtree(temp_dir)


# Chat-related fixtures
@pytest.fixture
def sample_chats():
    """Provide sample chat data for testing."""
    return [
        Chat(
            id=1,
            name="English Practice",
            history={"content": [
                {
                    "id": 0,
                    "role": "user",
                    "content": "Hello",
                    "created_at": "2024-01-01T00:00:00",
                    "updated_at": "2024-01-01T00:00:00",
                    "is_note": False,
                    "image_ids": [],
                },
                {
                    "id": 1,
                    "role": "assistant",
                    "content": "Hi there! How can I help you practice English today?",
                    "created_at": "2024-01-01T00:05:00",
                    "updated_at": "2024-01-01T00:05:00",
                    "is_note": False,
                    "image_ids": [],
                },
            ]}
        ),
        Chat(
            id=2,
            name="Spanish Learning",
            history={"content": [
                {
                    "id": 0,
                    "role": "user",
                    "content": "Hola",
                    "created_at": "2024-01-01T01:00:00",
                    "updated_at": "2024-01-01T01:00:00",
                    "is_note": False,
                    "image_ids": [],
                },
                {
                    "id": 1,
                    "role": "assistant",
                    "content": "¡Hola! ¿En qué puedo ayudarte?",
                    "created_at": "2024-01-01T01:02:00",
                    "updated_at": "2024-01-01T01:02:00",
                    "is_note": False,
                    "image_ids": [],
                },
            ]}
        ),
        Chat(
            id=3, 
            name="Empty Chat", 
            history={"content": []}
        )
    ]


# English dictionary fixtures
@pytest.fixture
def sample_english_dictionary_entries():
    """Provide sample English dictionary entries for database tests."""
    return [
        {
            "word": "hello",
            "word_meta": {
                "word": "hello",
                "entries": [
                    {
                        "word": "hello",
                        "pos_groups": [
                            {
                                "pos": "interjection",
                                "senses": [
                                    {
                                        "context_en": "Used as a greeting",
                                        "translations": [
                                            {
                                                "translation": "",
                                                "examples": [
                                                    {
                                                        "source_text": "Hello there!",
                                                        "target_text": "Hello there!"
                                                    }
                                                ]
                                            }
                                        ],
                                        "synonyms": [],
                                        "antonyms": []
                                    }
                                ]
                            }
                        ]
                    }
                ],
                "audio": {
                    "text": "hello",
                    "audio_url": "https://example.com/hello.mp3",
                    "lang": "en"
                },
                "dialect": "us"
            }
        },
        {
            "word": "world",
            "word_meta": {
                "word": "world",
                "entries": [
                    {
                        "word": "world",
                        "pos_groups": [
                            {
                                "pos": "noun",
                                "senses": [
                                    {
                                        "context_en": "The earth with all its countries and peoples",
                                        "translations": [
                                            {
                                                "translation": "",
                                                "examples": [
                                                    {
                                                        "source_text": "Travel around the world",
                                                        "target_text": "Travel around the world"
                                                    }
                                                ]
                                            }
                                        ],
                                        "synonyms": [],
                                        "antonyms": []
                                    }
                                ]
                            }
                        ]
                    }
                ],
                "audio": None,
                "dialect": "us"
            }
        }
    ]


# Spanish dictionary fixtures
@pytest.fixture
def sample_spanish_dictionary_entries():
    """Provide sample Spanish dictionary entries for database tests."""
    return [
        {
            "word": "hola",
            "word_data": [
                {
                    "word": "hola",
                    "pos_groups": [
                        {
                            "pos": "interjection",
                            "senses": [
                                {
                                    "context_en": "greeting",
                                    "context_es": "saludo",
                                    "gender": None,
                                    "translations": [
                                        {
                                            "translation": "hello",
                                            "context": "casual greeting",
                                            "examples": [
                                                {
                                                    "source_text": "¡Hola! ¿Cómo estás?",
                                                    "target_text": "Hello! How are you?"
                                                }
                                            ]
                                        }
                                    ],
                                    "synonyms": [],
                                    "antonyms": []
                                }
                            ]
                        }
                    ]
                }
            ],
            "audio_data": {
                "headword": {
                    "displayText": "hola",
                    "textToPronounce": "hola",
                    "audioUrl": "https://example.com/hola.mp3",
                    "wordLang": "es"
                }
            },
            "conjugation_data": None
        },
        {
            "word": "correr",
            "word_data": [
                {
                    "word": "correr",
                    "pos_groups": [
                        {
                            "pos": "verb",
                            "senses": [
                                {
                                    "context_en": "movement",
                                    "context_es": "movimiento",
                                    "gender": None,
                                    "translations": [
                                        {
                                            "translation": "to run",
                                            "context": "physical movement",
                                            "examples": [
                                                {
                                                    "source_text": "Me gusta correr en el parque",
                                                    "target_text": "I like to run in the park"
                                                }
                                            ]
                                        }
                                    ],
                                    "synonyms": [],
                                    "antonyms": []
                                }
                            ]
                        }
                    ]
                }
            ],
            "audio_data": {},
            "conjugation_data": None
        }
    ]


# Text processing fixtures
@pytest.fixture
def sample_texts():
    """Provide sample texts for text processing tests."""
    return {
        "simple": "Hello world",
        "punctuation": "Hello, world! How are you?",
        "numbers": "I have 5 cats and 10 dogs",
        "empty": "",
        "whitespace": "   \n\t  ",
        "complex": "The quick brown fox jumps over the lazy dog.",
        "spanish": "Hola mundo, ¿cómo estás?"
    }


@pytest.fixture
def sample_word_data():
    """Provide sample word data for database tests."""
    return [
        {
            "text": "Hello",
            "lemma": "hello",
            "pos": "INTJ",
            "tag": "UH",
            "is_stop": False,
            "is_punct": False,
            "ent_type": ""
        },
        {
            "text": "world",
            "lemma": "world",
            "pos": "NOUN",
            "tag": "NN",
            "is_stop": False,
            "is_punct": False,
            "ent_type": ""
        }
    ]


# Sentence and text model fixtures
@pytest.fixture
def sample_sentence_data(test_session):
    """Create sample texts, phrases, and words in the database."""
    # Create sample texts
    text1 = Text(
        id=1,
        title="Sample Text 1",
        language="en",
        category="fiction",
        source="test"
    )
    text2 = Text(
        id=2,
        title="Sample Text 2", 
        language="en",
        category="fiction",
        source="test"
    )
    
    test_session.add_all([text1, text2])
    test_session.commit()
    test_session.refresh(text1)
    test_session.refresh(text2)
    
    # Create sample phrases
    phrases = [
        Phrase(id=1, text="Hello world and welcome to our wonderful program", language="en", text_id=text1.id),
        Phrase(id=2, text="This is a simple test that demonstrates basic functionality", language="en", text_id=text1.id),
        Phrase(id=3, text="The quick brown fox jumps over the lazy dog", language="en", text_id=text2.id),
        Phrase(id=4, text="Hello there friend how are you doing today", language="en", text_id=text2.id),
        Phrase(id=5, text="Good morning everyone and have a great day", language="en", text_id=text2.id),
    ]
    
    test_session.add_all(phrases)
    test_session.commit()
    
    # Create sample words
    words = [
        Word(text="hello", lemma="hello", pos="INTJ", tag="UH", phrase_id=1, text_id=text1.id),
        Word(text="world", lemma="world", pos="NOUN", tag="NN", phrase_id=1, text_id=text1.id),
        Word(text="this", lemma="this", pos="PRON", tag="DT", phrase_id=2, text_id=text1.id),
        Word(text="is", lemma="be", pos="AUX", tag="VBZ", phrase_id=2, text_id=text1.id),
        Word(text="simple", lemma="simple", pos="ADJ", tag="JJ", phrase_id=2, text_id=text1.id),
        Word(text="test", lemma="test", pos="NOUN", tag="NN", phrase_id=2, text_id=text1.id),
    ]
    
    test_session.add_all(words)
    test_session.commit()
    
    return {
        "texts": [text1, text2],
        "phrases": phrases,
        "words": words
    }


# Real Spanish dictionary fixtures
@pytest.fixture
def real_spanish_dict_fixtures():
    """Provide access to real Spanish dictionary payloads."""
    from backend.tests.fixtures.spanish_dict_loader import SpanishDictFixtures
    return SpanishDictFixtures


# API response fixtures for external services
@pytest.fixture
def sample_dictionary_api_responses():
    """Provide sample API response data for dictionary service testing."""
    return {
        "english_simple": [
            {
                "word": "hello",
                "phonetics": [
                    {"audio": "https://example.com/hello.mp3", "text": "/həˈloʊ/"}
                ],
                "meanings": [
                    {
                        "partOfSpeech": "interjection",
                        "definitions": [
                            {
                                "definition": "Used as a greeting",
                                "example": "Hello there!"
                            }
                        ]
                    }
                ]
            }
        ],
        "english_complex": [
            {
                "word": "run",
                "phonetics": [
                    {"audio": "https://example.com/us/run.mp3", "text": "/rʌn/"},
                    {"audio": "https://example.com/uk/run.mp3", "text": "/rʌn/"}
                ],
                "meanings": [
                    {
                        "partOfSpeech": "verb",
                        "definitions": [
                            {
                                "definition": "Move at a speed faster than a walk",
                                "example": "She ran to the store"
                            },
                            {
                                "definition": "Operate or function",
                                "example": "The engine runs smoothly"
                            }
                        ]
                    },
                    {
                        "partOfSpeech": "noun",
                        "definitions": [
                            {
                                "definition": "An act of running",
                                "example": "I went for a run"
                            }
                        ]
                    }
                ]
            }
        ],
        "spanish_simple": '''
            <html>
            <body>
                <div class="dictionary-entry">
                    <span class="word">hola</span>
                    <div class="definition">hello</div>
                </div>
            </body>
            </html>
        ''',
    }


# Helper functions for creating test data
def create_english_dictionary_entry(test_session, word, word_meta):
    """Helper function to create English dictionary entries in the database."""
    dictionary_entry = Dictionary(word=word, word_meta=word_meta)
    test_session.add(dictionary_entry)
    test_session.commit()
    test_session.refresh(dictionary_entry)
    return dictionary_entry


def create_spanish_dictionary_entry(test_session, word, word_data, audio_data=None, conjugation_data=None):
    """Helper function to create Spanish dictionary entries in the database."""
    dictionary_entry = SpanishDictionary(
        word=word, 
        word_data=word_data,
        audio_data=audio_data or {},
        conjugation_data=conjugation_data
    )
    test_session.add(dictionary_entry)
    test_session.commit()
    test_session.refresh(dictionary_entry)
    return dictionary_entry


def create_chat(test_session, name, history=None):
    """Helper function to create chats in the database."""
    if history is None:
        history = {"content": []}
    
    chat = Chat(name=name, history=history)
    test_session.add(chat)
    test_session.commit()
    test_session.refresh(chat)
    return chat
