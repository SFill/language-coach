import pytest
from unittest.mock import patch
from sqlmodel import Session, SQLModel, create_engine, select
from sqlalchemy.pool import StaticPool
from fastapi import HTTPException

from backend.services.dictionary_service import (
    DictionaryApiClient, parse_english_word_definition,
    get_english_word_definition
)
from backend.models.dict_english import (
    EnglishDialect, Dictionary, EnglishWordDefinition, 
    EnglishWordEntry, EnglishPosGroup, EnglishSense
)
from backend.models.shared import Example, AudioInfo


class TestDictionaryApiClient:
    """Test the external dictionary API client - only mock external HTTP calls."""
    
    @pytest.fixture
    def sample_api_responses(self):
        """Provide sample API response data."""
        return {
            "simple": [
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
            "complex": [
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
            "empty": [],
            "malformed": [
                {
                    "word": "test",
                    # Missing required fields
                }
            ]
        }
    
    @patch('requests.get')
    def test_define_success_simple(self, mock_get, sample_api_responses):
        """Test successful API call with simple word."""
        # Mock HTTP response
        class MockResponse:
            def __init__(self, json_data, status_code=200):
                self.json_data = json_data
                self.status_code = status_code
            
            def json(self):
                return self.json_data
        
        mock_get.return_value = MockResponse(sample_api_responses["simple"])
        
        result = DictionaryApiClient.define("hello")
        
        assert result == sample_api_responses["simple"]
        mock_get.assert_called_once()
        
        # Verify correct API URL was called
        call_args = mock_get.call_args
        assert "dictionaryapi.dev" in call_args[0][0]
        assert "hello" in call_args[0][0]
    
    @patch('requests.get')
    def test_define_success_complex(self, mock_get, sample_api_responses):
        """Test successful API call with complex word."""
        class MockResponse:
            def __init__(self, json_data, status_code=200):
                self.json_data = json_data
                self.status_code = status_code
            
            def json(self):
                return self.json_data
        
        mock_get.return_value = MockResponse(sample_api_responses["complex"])
        
        result = DictionaryApiClient.define("run")
        
        assert result == sample_api_responses["complex"]
        assert len(result[0]["meanings"]) == 2  # Verb and noun
        assert len(result[0]["phonetics"]) == 2  # US and UK pronunciations
    
    @patch('requests.get')
    def test_define_http_error_404(self, mock_get):
        """Test API call with 404 error."""
        mock_response = type('MockResponse', (), {
            'status_code': 404,
            'json': lambda: {"title": "No Definitions Found"}
        })()
        mock_get.return_value = mock_response
        
        with pytest.raises(Exception) as exc_info:
            DictionaryApiClient.define("nonexistent")
        
        assert "Error fetching definition" in str(exc_info.value)
    
    @patch('requests.get')
    def test_define_http_error_500(self, mock_get):
        """Test API call with server error."""
        mock_response = type('MockResponse', (), {
            'status_code': 500,
            'json': lambda: {"error": "Internal server error"}
        })()
        mock_get.return_value = mock_response
        
        with pytest.raises(Exception) as exc_info:
            DictionaryApiClient.define("test")
        
        assert "Error fetching definition" in str(exc_info.value)
    
    @patch('requests.get')
    def test_define_network_error(self, mock_get):
        """Test API call with network error."""
        mock_get.side_effect = ConnectionError("Network unreachable")
        
        with pytest.raises(ConnectionError):
            DictionaryApiClient.define("test")
    
    @patch('requests.get')
    def test_define_json_decode_error(self, mock_get):
        """Test API call with malformed JSON response."""
        class MockResponse:
            def __init__(self):
                self.status_code = 200
            
            def json(self):
                raise ValueError("Invalid JSON")
        
        mock_get.return_value = MockResponse()
        
        with pytest.raises(ValueError):
            DictionaryApiClient.define("test")


class TestParseEnglishWordDefinition:
    """Test parsing of API responses into domain objects."""
    
    @pytest.fixture
    def sample_api_data(self):
        """Provide sample API data for parsing tests."""
        return {
            "simple": [
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
            "complex": [
                {
                    "word": "book",
                    "phonetics": [
                        {"audio": "https://example.com/us/book.mp3", "text": "/bʊk/"},
                        {"audio": "https://example.com/uk/book.mp3", "text": "/bʊk/"}
                    ],
                    "meanings": [
                        {
                            "partOfSpeech": "noun",
                            "definitions": [
                                {
                                    "definition": "A written work published in printed or electronic form",
                                    "example": "I'm reading a good book"
                                },
                                {
                                    "definition": "A bound set of blank sheets for writing in",
                                    "example": "She wrote in her diary book"
                                }
                            ]
                        },
                        {
                            "partOfSpeech": "verb",
                            "definitions": [
                                {
                                    "definition": "Reserve accommodation or travel",
                                    "example": "Book a table at the restaurant"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    
    def test_parse_empty_data(self):
        """Test parsing empty API response."""
        result = parse_english_word_definition([], "test")
        
        assert isinstance(result, EnglishWordDefinition)
        assert result.word == "test"
        assert result.entries == []
        assert result.audio is None
        assert result.dialect == EnglishDialect.us
    
    def test_parse_simple_word(self, sample_api_data):
        """Test parsing simple word definition."""
        result = parse_english_word_definition(sample_api_data["simple"], "hello")
        
        assert isinstance(result, EnglishWordDefinition)
        assert result.word == "hello"
        assert len(result.entries) == 1
        
        # Check audio information
        assert result.audio is not None
        assert isinstance(result.audio, AudioInfo)
        assert result.audio.audio_url == "https://example.com/hello.mp3"
        assert result.audio.text == "hello"
        
        # Check dialect detection (should default to US)
        assert result.dialect == EnglishDialect.us
        
        # Check entry structure
        entry = result.entries[0]
        assert isinstance(entry, EnglishWordEntry)
        assert entry.word == "hello"
        assert len(entry.pos_groups) == 1
        
        # Check part of speech group
        pos_group = entry.pos_groups[0]
        assert isinstance(pos_group, EnglishPosGroup)
        assert pos_group.pos == "interjection"
        assert len(pos_group.senses) == 1
        
        # Check sense
        sense = pos_group.senses[0]
        assert isinstance(sense, EnglishSense)
        assert sense.context_en == "Used as a greeting"
        assert len(sense.translations) == 1
        assert len(sense.translations[0].examples) == 1
        assert sense.translations[0].examples[0].source_text == "Hello there!"
    
    def test_parse_complex_word(self, sample_api_data):
        """Test parsing complex word with multiple parts of speech."""
        result = parse_english_word_definition(sample_api_data["complex"], "book")
        
        assert result.word == "book"
        assert len(result.entries) == 1
        
        entry = result.entries[0]
        assert len(entry.pos_groups) == 2
        
        # Check noun group
        noun_group = next(g for g in entry.pos_groups if g.pos == "noun")
        assert len(noun_group.senses) == 2
        assert "written work" in noun_group.senses[0].context_en
        assert "blank sheets" in noun_group.senses[1].context_en
        
        # Check verb group
        verb_group = next(g for g in entry.pos_groups if g.pos == "verb")
        assert len(verb_group.senses) == 1
        assert "Reserve" in verb_group.senses[0].context_en
    
    def test_parse_audio_dialect_detection_us(self):
        """Test US dialect detection from audio URL."""
        api_data = [
            {
                "word": "color",
                "phonetics": [
                    {"audio": "https://example.com/us/color.mp3", "text": "/ˈkʌlər/"}
                ],
                "meanings": []
            }
        ]
        
        result = parse_english_word_definition(api_data, "color")
        assert result.dialect == EnglishDialect.us
    
    def test_parse_audio_dialect_detection_uk(self):
        """Test UK dialect detection from audio URL."""
        api_data = [
            {
                "word": "colour",
                "phonetics": [
                    {"audio": "https://example.com/uk/colour.mp3", "text": "/ˈkʌlə/"}
                ],
                "meanings": []
            }
        ]
        
        result = parse_english_word_definition(api_data, "colour")
        assert result.dialect == EnglishDialect.uk
    
    def test_parse_multiple_phonetics(self):
        """Test parsing with multiple phonetic variants."""
        api_data = [
            {
                "word": "schedule",
                "phonetics": [
                    {"audio": "", "text": "/ˈʃɛdjuːl/"},
                    {"audio": "https://example.com/us/schedule.mp3", "text": "/ˈskɛdʒuːl/"},
                    {"audio": "https://example.com/uk/schedule.mp3", "text": "/ˈʃɛdjuːl/"}
                ],
                "meanings": []
            }
        ]
        
        result = parse_english_word_definition(api_data, "schedule")
        
        # Should pick the first audio with actual URL
        assert result.audio is not None
        assert "us/schedule" in result.audio.audio_url
        assert result.dialect == EnglishDialect.us
    
    def test_parse_no_audio(self):
        """Test parsing word with no audio information."""
        api_data = [
            {
                "word": "test",
                "phonetics": [],
                "meanings": [
                    {
                        "partOfSpeech": "noun",
                        "definitions": [{"definition": "A test"}]
                    }
                ]
            }
        ]
        
        result = parse_english_word_definition(api_data, "test")
        assert result.audio is None
        assert result.dialect == EnglishDialect.us  # Default
    
    def test_parse_malformed_data_graceful_handling(self):
        """Test graceful handling of malformed API data."""
        malformed_data = [
            {
                "word": "test",
                "meanings": [
                    {
                        "partOfSpeech": "noun",
                        "definitions": [
                            {
                                "definition": "A test"
                                # Missing example field is OK
                            }
                        ]
                    }
                ]
            }
        ]
        
        result = parse_english_word_definition(malformed_data, "test")
        assert result.word == "test"
        assert len(result.entries) == 1
        
        sense = result.entries[0].pos_groups[0].senses[0]
        assert sense.context_en == "A test"
        assert len(sense.translations) == 1
        assert len(sense.translations[0].examples) == 0


class TestEnglishWordDefinitionService:
    """Test the complete dictionary service with real database operations."""
    
    @pytest.fixture
    def sample_dictionary_entries(self):
        """Provide sample dictionary entries for database tests."""
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
    
    def test_get_definition_from_cache_single_word(self, test_session, sample_dictionary_entries):
        """Test retrieving cached definition for single word."""
        # Add sample data to database
        entry_data = sample_dictionary_entries[0]
        dictionary_entry = Dictionary(word=entry_data["word"], word_meta=entry_data["word_meta"])
        test_session.add(dictionary_entry)
        test_session.commit()
        
        # Test retrieval
        result = get_english_word_definition(["hello"], test_session, read_only=True)
        
        assert isinstance(result, list)
        assert len(result) == 1
        
        definition = result[0]
        assert isinstance(definition, EnglishWordDefinition)
        assert definition.word == "hello"
        assert len(definition.entries) == 1
        assert definition.entries[0].pos_groups[0].pos == "interjection"
    
    def test_get_definition_from_cache_multiple_words(self, test_session, sample_dictionary_entries):
        """Test retrieving cached definitions for multiple words."""
        # Add sample data to database
        for entry_data in sample_dictionary_entries:
            dictionary_entry = Dictionary(word=entry_data["word"], word_meta=entry_data["word_meta"])
            test_session.add(dictionary_entry)
        test_session.commit()
        
        # Test retrieval
        result = get_english_word_definition(["hello", "world"], test_session, read_only=True)
        
        assert len(result) == 2
        words = [d.word for d in result]
        assert "hello" in words
        assert "world" in words
    
    def test_get_definition_not_found_read_only(self, test_session):
        """Test handling of non-existent words in read-only mode."""
        result = get_english_word_definition(["nonexistent"], test_session, read_only=True)
        
        assert len(result) == 1
        definition = result[0]
        assert definition.word == "nonexistent"
        assert definition.entries == []
        assert definition.audio is None
    
    @patch('backend.services.dictionary_service.DictionaryApiClient.define')
    def test_get_definition_api_call_success(self, mock_define, test_session):
        """Test successful API call when word not in cache."""
        # Mock API response
        mock_api_data = [
            {
                "word": "test",
                "phonetics": [
                    {"audio": "https://example.com/test.mp3", "text": "/tɛst/"}
                ],
                "meanings": [
                    {
                        "partOfSpeech": "noun",
                        "definitions": [
                            {"definition": "A procedure for evaluation", "example": "Take a test"}
                        ]
                    }
                ]
            }
        ]
        mock_define.return_value = mock_api_data
        
        # Test API call
        result = get_english_word_definition(["test"], test_session, read_only=False)
        
        assert len(result) == 1
        definition = result[0]
        assert definition.word == "test"
        assert len(definition.entries) == 1
        assert definition.audio is not None
        
        # Verify API was called
        mock_define.assert_called_once_with("test")
        
        # Verify data was saved to cache
        test_session.commit()
        cached_entry = test_session.exec(select(Dictionary).where(Dictionary.word == "test")).first()
        assert cached_entry is not None
        assert cached_entry.word_meta["word"] == "test"
    
    @patch('backend.services.dictionary_service.DictionaryApiClient.define')
    def test_get_definition_api_call_failure(self, mock_define, test_session):
        """Test API call failure handling."""
        mock_define.side_effect = Exception("API Error")
        
        result = get_english_word_definition(["failed"], test_session, read_only=False)
        
        # Should return empty definition on API failure
        assert len(result) == 1
        definition = result[0]
        assert definition.word == "failed"
        assert definition.entries == []
    
    def test_get_definition_no_session(self):
        """Test behavior when no session is provided."""
        result = get_english_word_definition(["test"], None, read_only=True)
        
        assert len(result) == 1
        definition = result[0]
        assert definition.word == "test"
        assert definition.entries == []
    
    @patch('backend.services.dictionary_service.DictionaryApiClient.define')
    def test_get_definition_mixed_cache_and_api(self, mock_define, test_session, sample_dictionary_entries):
        """Test getting some words from cache and others from API."""
        # Add one word to cache
        entry_data = sample_dictionary_entries[0]
        dictionary_entry = Dictionary(word=entry_data["word"], word_meta=entry_data["word_meta"])
        test_session.add(dictionary_entry)
        test_session.commit()
        
        # Mock API response for new word
        mock_define.return_value = [
            {
                "word": "new",
                "phonetics": [],
                "meanings": [
                    {
                        "partOfSpeech": "adjective",
                        "definitions": [{"definition": "Recently created"}]
                    }
                ]
            }
        ]
        
        # Request both cached and new word
        result = get_english_word_definition(["hello", "new"], test_session, read_only=False)
        
        assert len(result) == 2
        words = [d.word for d in result]
        assert "hello" in words
        assert "new" in words
        
        # API should only be called for the new word
        mock_define.assert_called_once_with("new")
    
    def test_get_definition_empty_word_list(self, test_session):
        """Test handling of empty word list."""
        result = get_english_word_definition([], test_session)
        assert result == []
    
    def test_get_definition_case_sensitivity(self, test_session, sample_dictionary_entries):
        """Test case handling in word lookups."""
        # Add lowercase word to cache
        entry_data = sample_dictionary_entries[0]
        dictionary_entry = Dictionary(word=entry_data["word"], word_meta=entry_data["word_meta"])
        test_session.add(dictionary_entry)
        test_session.commit()
        
        # Test with different cases
        result_lower = get_english_word_definition(["hello"], test_session, read_only=True)
        result_upper = get_english_word_definition(["HELLO"], test_session, read_only=True)
        result_mixed = get_english_word_definition(["Hello"], test_session, read_only=True)
        
        # Should handle case appropriately (exact behavior depends on implementation)
        assert len(result_lower) == 1
        assert len(result_upper) == 1  
        assert len(result_mixed) == 1