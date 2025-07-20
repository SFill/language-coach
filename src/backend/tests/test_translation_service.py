import pytest
from unittest.mock import Mock, patch

from backend.services.translation_service import (
    GoogleTranslateHelper, translate_text
)
from backend.models.wordlist import TranslateTextRequest


class TestGoogleTranslateHelper:
    
    def setup_method(self):
        self.helper = GoogleTranslateHelper()
    
    @patch('requests.post')
    def test_translate_success(self, mock_post):
        mock_response = Mock()
        # Correct response format: [['translated text']]
        mock_response.json.return_value = [["Hello world"]]
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response
        
        result = self.helper.translate("Hola mundo", "en", "es")
        
        assert result == "Hello world"
        mock_post.assert_called_once()
        
        # Verify the request was made with correct parameters
        args, kwargs = mock_post.call_args
        assert "translate-pa.googleapis.com" in args[0]
        assert "json" in kwargs
    
    @patch('requests.post')
    def test_translate_http_error(self, mock_post):
        mock_response = Mock()
        mock_response.json.side_effect = Exception("HTTP 400")
        mock_post.return_value = mock_response
        
        with pytest.raises(Exception) as exc_info:
            self.helper.translate("Hola", "en", "es")
        
        assert "HTTP 400" in str(exc_info.value)
    
    @patch('requests.post')
    def test_translate_empty_response(self, mock_post):
        mock_response = Mock()
        mock_response.json.return_value = [[]]
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response
        
        with pytest.raises(Exception) as exc_info:
            self.helper.translate("Hola", "en", "es")
        
        assert "list index out of range" in str(exc_info.value)
    
    @patch('requests.post')
    def test_translate_malformed_response(self, mock_post):
        mock_response = Mock()
        mock_response.json.return_value = {"error": "Invalid request"}
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response
        
        with pytest.raises(KeyError) as exc_info:
            self.helper.translate("Hola", "en", "es")
        
        assert "0" in str(exc_info.value)
    
    def test_basic_functionality(self):
        # Test basic class initialization
        assert self.helper.API_URL == "https://translate-pa.googleapis.com/v1/translateHtml"
        assert hasattr(self.helper, '_get_token')
        assert hasattr(self.helper, 'translate')


class TestTranslateText:
    
    @patch('backend.services.translation_service.GoogleTranslateHelper')
    def test_translate_text_success(self, mock_helper_class):
        mock_helper = Mock()
        mock_helper.translate.return_value = "Hello world"
        mock_helper_class.return_value = mock_helper
        
        request = TranslateTextRequest(
            text="Hola mundo",
            target="en"
        )
        
        result = translate_text(request)
        
        assert result == {"text": "Hello world"}
        mock_helper.translate.assert_called_once_with("Hola mundo", "en")
    
    @patch('backend.services.translation_service.GoogleTranslateHelper')
    def test_translate_text_with_default_languages(self, mock_helper_class):
        mock_helper = Mock()
        mock_helper.translate.return_value = "Translated text"
        mock_helper_class.return_value = mock_helper
        
        request = TranslateTextRequest(text="Some text", target="en")
        
        result = translate_text(request)
        
        assert result == {"text": "Translated text"}
        # Should use target language
        mock_helper.translate.assert_called_once_with("Some text", "en")
    
    @patch('backend.services.translation_service.GoogleTranslateHelper')
    def test_translate_text_translation_error(self, mock_helper_class):
        mock_helper = Mock()
        mock_helper.translate.side_effect = Exception("Translation service unavailable")
        mock_helper_class.return_value = mock_helper
        
        request = TranslateTextRequest(text="Test text", target="en")
        
        with pytest.raises(Exception) as exc_info:
            translate_text(request)
        
        assert "Translation service unavailable" in str(exc_info.value)
    
    @patch('backend.services.translation_service.GoogleTranslateHelper')
    def test_translate_text_empty_text(self, mock_helper_class):
        mock_helper = Mock()
        mock_helper.translate.return_value = ""
        mock_helper_class.return_value = mock_helper
        
        request = TranslateTextRequest(text="", target="en")
        
        result = translate_text(request)
        
        assert result == {"text": ""}
        mock_helper.translate.assert_called_once_with("", "en")
    
    @patch('backend.services.translation_service.GoogleTranslateHelper')
    def test_translate_text_special_characters(self, mock_helper_class):
        mock_helper = Mock()
        mock_helper.translate.return_value = "Hello! How are you?"
        mock_helper_class.return_value = mock_helper
        
        request = TranslateTextRequest(
            text="¡Hola! ¿Cómo estás?",
            target="en"
        )
        
        result = translate_text(request)
        
        assert result == {"text": "Hello! How are you?"}
        mock_helper.translate.assert_called_once_with("¡Hola! ¿Cómo estás?", "en")