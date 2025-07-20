import pytest
from unittest.mock import Mock, patch
from fastapi import HTTPException

from backend.services.sentence.sentence_service import (
    get_sentence_retriever, search_for_sentences
)


class TestSentenceService:
    
    def teardown_method(self):
        # Reset the global singleton for each test
        from backend.services.sentence import sentence_service
        sentence_service._sentence_retriever = None
    
    def test_get_sentence_retriever_creates_new_instance(self):
        # This test just checks that a SentenceRetriever instance is created
        result = get_sentence_retriever("intermediate")
        
        assert result is not None
        assert hasattr(result, 'get_best_examples')
    
    @patch('backend.services.sentence.sentence_service.SentenceRetriever')
    def test_get_sentence_retriever_returns_singleton(self, mock_retriever_class):
        mock_retriever = Mock()
        mock_retriever_class.return_value = mock_retriever
        
        # First call
        result1 = get_sentence_retriever("intermediate")
        # Second call
        result2 = get_sentence_retriever("advanced")  # Different proficiency
        
        assert result1 == result2 == mock_retriever
        # Should only be called once due to singleton pattern
        mock_retriever_class.assert_called_once()
    
    @patch('backend.services.sentence.sentence_service.SentenceRetriever')
    def test_get_sentence_retriever_initialization_error(self, mock_retriever_class):
        mock_retriever_class.side_effect = Exception("Database connection failed")
        
        with pytest.raises(HTTPException) as exc_info:
            get_sentence_retriever()
        
        assert exc_info.value.status_code == 500
        assert "Failed to initialize sentence retriever" in exc_info.value.detail
    
    @patch('backend.services.sentence.sentence_service.get_sentence_retriever')
    def test_search_for_sentences_success(self, mock_get_retriever):
        mock_retriever = Mock()
        mock_retriever.get_best_examples.return_value = [
            {"sentence": "Hello world", "score": 0.9, "text_id": "1", "title": "Test", "category": "test"},
            {"sentence": "Hello there", "score": 0.8, "text_id": "2", "title": "Test", "category": "test"}
        ]
        mock_get_retriever.return_value = mock_retriever
        
        result = search_for_sentences("hello", "en", 5, "intermediate")
        
        assert len(result) == 2
        assert result[0]["sentence"] == "Hello world"
        assert result[0]["score"] == 0.9
        assert result[0]["id"] == "1"
        mock_retriever.get_best_examples.assert_called_once_with(
            phrase="hello",
            language="en",
            top_n=5
        )
        mock_get_retriever.assert_called_once_with("intermediate")
    
    @patch('backend.services.sentence.sentence_service.get_sentence_retriever')
    def test_search_for_sentences_no_results(self, mock_get_retriever):
        mock_retriever = Mock()
        mock_retriever.get_best_examples.return_value = []
        mock_get_retriever.return_value = mock_retriever
        
        result = search_for_sentences("nonexistent", "en", 5, "intermediate")
        
        assert result == []
        mock_retriever.get_best_examples.assert_called_once_with(
            phrase="nonexistent",
            language="en",
            top_n=5
        )
    
    @patch('backend.services.sentence.sentence_service.get_sentence_retriever')
    def test_search_for_sentences_retriever_error(self, mock_get_retriever):
        mock_retriever = Mock()
        mock_retriever.get_best_examples.side_effect = Exception("Search failed")
        mock_get_retriever.return_value = mock_retriever
        
        with pytest.raises(HTTPException) as exc_info:
            search_for_sentences("hello", "en", 5, "intermediate")
        
        assert exc_info.value.status_code == 500
        assert "Error searching for sentences" in exc_info.value.detail
    
    @patch('backend.services.sentence.sentence_service.get_sentence_retriever')
    def test_search_for_sentences_default_parameters(self, mock_get_retriever):
        mock_retriever = Mock()
        mock_retriever.get_best_examples.return_value = []
        mock_get_retriever.return_value = mock_retriever
        
        search_for_sentences("test")
        
        mock_retriever.get_best_examples.assert_called_once_with(
            phrase="test",
            language="en",
            top_n=5
        )
        mock_get_retriever.assert_called_once_with("intermediate")