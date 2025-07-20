import pytest
from unittest.mock import patch
from fastapi import HTTPException

from backend.services.unified_dictionary_service import get_word_definition
from backend.models.dict_english import EnglishWordDefinition, EnglishDialect
from backend.models.dict_spanish import SpanishWordDefinition


class TestUnifiedDictionaryService:
    """Test the unified dictionary service that delegates to language-specific services."""
    
    
    def test_get_word_definition_unsupported_language(self, test_session):
        """Test that unsupported languages raise appropriate error."""
        with pytest.raises(HTTPException) as exc_info:
            get_word_definition(["word"], "fr", test_session)
        
        assert exc_info.value.status_code == 400
        assert "Unsupported language" in exc_info.value.detail
    
    def test_get_word_definition_empty_word_list(self, test_session):
        """Test handling of empty word list."""
        result = get_word_definition([], "en", test_session)
        assert result == []
        
        result = get_word_definition([], "es", test_session)
        assert result == []
    
    @patch('backend.services.unified_dictionary_service.get_english_definition')
    def test_get_word_definition_english_delegation(self, mock_get_english, test_session):
        """Test that English requests are properly delegated to English service."""
        # Mock English service response
        mock_english_def = EnglishWordDefinition(
            word="hello",
            entries=[],
            audio=None,
            dialect=EnglishDialect.us
        )
        mock_get_english.return_value = [mock_english_def]
        
        result = get_word_definition(["hello"], "en", test_session)
        
        # Verify delegation occurred
        mock_get_english.assert_called_once_with(["hello"], test_session, read_only=False)
        
        # Verify result structure
        assert isinstance(result, list)
        assert len(result) == 1
        assert isinstance(result[0], EnglishWordDefinition)
        assert result[0].word == "hello"
    
    @patch('backend.services.unified_dictionary_service.get_spanish_word_definition')
    def test_get_word_definition_spanish_delegation(self, mock_get_spanish, test_session):
        """Test that Spanish requests are properly delegated to Spanish service."""
        # Mock Spanish service response
        mock_spanish_def = SpanishWordDefinition(
            word="hola",
            entries=[],
            conjugations=None,
            spanish_audio=None,
            english_audio=None
        )
        mock_get_spanish.return_value = [mock_spanish_def]
        
        result = get_word_definition(["hola"], "es", test_session)
        
        # Verify delegation occurred - Spanish service has different parameter order
        mock_get_spanish.assert_called_once_with(
            ["hola"], 
            False,  # include_conjugations
            test_session,  # session
            False,  # override_cache
            read_only=False
        )
        
        # Verify result structure
        assert isinstance(result, list)
        assert len(result) == 1
        assert isinstance(result[0], SpanishWordDefinition)
        assert result[0].word == "hola"
    
    @patch('backend.services.unified_dictionary_service.get_english_definition')
    def test_get_word_definition_multiple_english_words(self, mock_get_english, test_session):
        """Test handling multiple English words."""
        # Mock responses for multiple words
        mock_definitions = [
            EnglishWordDefinition(word="hello", entries=[], audio=None, dialect=EnglishDialect.us),
            EnglishWordDefinition(word="world", entries=[], audio=None, dialect=EnglishDialect.us)
        ]
        mock_get_english.return_value = mock_definitions
        
        result = get_word_definition(["hello", "world"], "en", test_session)
        
        # Verify correct delegation
        mock_get_english.assert_called_once_with(["hello", "world"], test_session, read_only=False)
        
        # Verify results
        assert len(result) == 2
        words = [d.word for d in result]
        assert "hello" in words
        assert "world" in words
    
    @patch('backend.services.unified_dictionary_service.get_spanish_word_definition')
    def test_get_word_definition_multiple_spanish_words(self, mock_get_spanish, test_session):
        """Test handling multiple Spanish words."""
        # Mock responses for multiple words
        mock_definitions = [
            SpanishWordDefinition(word="hola", entries=[], conjugations=None, spanish_audio=None, english_audio=None),
            SpanishWordDefinition(word="mundo", entries=[], conjugations=None, spanish_audio=None, english_audio=None)
        ]
        mock_get_spanish.return_value = mock_definitions
        
        result = get_word_definition(["hola", "mundo"], "es", test_session)
        
        # Verify correct delegation - Spanish service has different parameter order
        mock_get_spanish.assert_called_once_with(
            ["hola", "mundo"], 
            False,  # include_conjugations
            test_session,  # session
            False,  # override_cache
            read_only=False
        )
        
        # Verify results
        assert len(result) == 2
        words = [d.word for d in result]
        assert "hola" in words
        assert "mundo" in words
    
    @patch('backend.services.unified_dictionary_service.get_english_definition')
    def test_get_word_definition_english_service_error(self, mock_get_english, test_session):
        """Test handling of English service errors."""
        # Mock English service to raise an error
        mock_get_english.side_effect = Exception("English service error")
        
        # The unified service should propagate the error
        with pytest.raises(Exception) as exc_info:
            get_word_definition(["hello"], "en", test_session)
        
        assert "English service error" in str(exc_info.value)
    
    @patch('backend.services.unified_dictionary_service.get_spanish_word_definition')
    def test_get_word_definition_spanish_service_error(self, mock_get_spanish, test_session):
        """Test handling of Spanish service errors."""
        # Mock Spanish service to raise an error
        mock_get_spanish.side_effect = Exception("Spanish service error")
        
        # The unified service should propagate the error
        with pytest.raises(Exception) as exc_info:
            get_word_definition(["hola"], "es", test_session)
        
        assert "Spanish service error" in str(exc_info.value)
    
    def test_get_word_definition_case_insensitive_language_codes(self, test_session):
        """Test that language codes are handled case-insensitively."""
        with patch('backend.services.unified_dictionary_service.get_english_definition') as mock_get_english:
            mock_get_english.return_value = []
            
            # Test uppercase
            get_word_definition(["hello"], "EN", test_session)
            mock_get_english.assert_called()
            
            mock_get_english.reset_mock()
            
            # Test mixed case
            get_word_definition(["hello"], "En", test_session)
            mock_get_english.assert_called()
        
        with patch('backend.services.unified_dictionary_service.get_spanish_word_definition') as mock_get_spanish:
            mock_get_spanish.return_value = []
            
            # Test uppercase
            get_word_definition(["hola"], "ES", test_session)
            mock_get_spanish.assert_called()
            
            mock_get_spanish.reset_mock()
            
            # Test mixed case
            get_word_definition(["hola"], "Es", test_session)
            mock_get_spanish.assert_called()
    
    def test_get_word_definition_invalid_language_format(self, test_session):
        """Test handling of invalid language codes."""
        invalid_codes = ["", "eng", "spanish", "123", "fr-FR"]
        
        for code in invalid_codes:
            with pytest.raises(HTTPException) as exc_info:
                get_word_definition(["word"], code, test_session)
            
            assert exc_info.value.status_code == 400
            assert "Unsupported language" in exc_info.value.detail
        
        # Test None language separately since it causes AttributeError
        with pytest.raises(AttributeError):
            get_word_definition(["word"], None, test_session)
    
    @patch('backend.services.unified_dictionary_service.get_english_definition')
    def test_get_word_definition_preserves_service_response_format(self, mock_get_english, test_session):
        """Test that the unified service preserves the response format from underlying services."""
        # Create a mock response with specific attributes
        mock_definition = EnglishWordDefinition(
            word="test",
            entries=[],
            audio=None,
            dialect=EnglishDialect.uk  # Specific dialect to verify preservation
        )
        
        mock_get_english.return_value = [mock_definition]
        
        result = get_word_definition(["test"], "en", test_session)
        
        # Verify the exact object is returned (no transformation)
        assert result[0] is mock_definition
        assert result[0].word == "test"
        assert result[0].dialect == EnglishDialect.uk  # Verify specific field value preserved