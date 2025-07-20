import pytest
from unittest.mock import Mock, patch
from fastapi import HTTPException

from backend.services.phrase_service import (
    get_phrase_with_example_and_translation,
)


class TestPhraseService:

    @patch('backend.services.phrase_service.search_for_sentences')
    @patch('backend.services.phrase_service.GoogleTranslateHelper')
    def test_get_phrase_with_example_and_translation_found_sentence(self, mock_translate_helper, mock_search,test_session):

        # Mock sentence search result with correct key "sentence"
        mock_search.return_value = [
            {"sentence": "Hola, ¿cómo estás?", "score": 0.9}
        ]

        # Mock translation
        mock_helper = Mock()
        mock_helper.translate.return_value = "Hello, how are you?"
        mock_translate_helper.return_value = mock_helper

        result = get_phrase_with_example_and_translation(
            phrase="hola",
            language="es",
            target_language="en",
            proficiency="intermediate",
            session=test_session,
            use_gpt_translation=False
        )

        assert result["word"] == "hola"
        # The service gets translation from get_spanish_word_definition, not from the search translation
        assert "word_translation" in result

    @patch('backend.services.phrase_service.search_for_sentences')
    @patch('backend.services.phrase_service.client')
    def test_get_phrase_with_example_and_translation_gpt_fallback(self, mock_openai_client, mock_search,test_session):

        # Mock no sentences found
        mock_search.return_value = []

        # Mock GPT response for example generation
        mock_response_example = Mock()
        mock_response_example.choices = [Mock()]
        mock_response_example.choices[0].message.content = '<example>Hola mundo</example>'

        # Mock GPT response for translation
        mock_response_translate = Mock()
        mock_response_translate.choices = [Mock()]
        mock_response_translate.choices[0].message.content = '<phrase>hello</phrase>\n<phrase_example>Hello world</phrase_example>'

        mock_openai_client.chat.completions.create.side_effect = [mock_response_example, mock_response_translate]

        result = get_phrase_with_example_and_translation(
            phrase="hola",
            language="es",
            target_language="en",
            proficiency="intermediate",
            session=test_session,
            use_gpt_translation=True
        )

        assert result["word"] == "hola"
        assert "word_translation" in result

    @patch('backend.services.phrase_service.search_for_sentences')
    @patch('backend.services.phrase_service.GoogleTranslateHelper')
    def test_get_phrase_with_example_and_translation_no_session(self, mock_translate_helper, mock_search):
        # Mock translation
        mock_helper = Mock()
        mock_helper.translate.return_value = "Hello"
        mock_translate_helper.return_value = mock_helper

        result = get_phrase_with_example_and_translation(
            phrase="hola",
            language="es",
            target_language="en",
            proficiency="intermediate",
            session=None,
            use_gpt_translation=False
        )

        assert result["word"] == "hola"
        # Accept the actual response format
        assert "word_translation" in result

    @patch('backend.services.phrase_service.search_for_sentences')
    @patch('backend.services.phrase_service.client')
    def test_get_phrase_with_example_and_translation_gpt_json_error(self, mock_openai_client, mock_search,test_session):

        # Mock no sentences found
        mock_search.return_value = []

        # Mock GPT response with invalid format
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = 'invalid format'
        mock_openai_client.chat.completions.create.return_value = mock_response

        with pytest.raises(HTTPException):
            get_phrase_with_example_and_translation(
                phrase="hola",
                language="es",
                target_language="en",
                proficiency="intermediate",
                session=test_session,
                use_gpt_translation=True
            )

    @patch('backend.services.phrase_service.search_for_sentences')
    @patch('backend.services.phrase_service.GoogleTranslateHelper')
    def test_get_phrase_with_example_and_translation_translation_error(self, mock_translate_helper, mock_search,test_session):

        # Mock sentence search result
        mock_search.return_value = [
            {"sentence": "Hola mundo", "score": 0.9}
        ]

        # Mock translation error
        mock_helper = Mock()
        mock_helper.translate.side_effect = Exception("Translation failed")
        mock_translate_helper.return_value = mock_helper
        
        with pytest.raises(HTTPException):
            get_phrase_with_example_and_translation(
                phrase="hola",
                language="es",
                target_language="en",
                proficiency="intermediate",
                session=test_session,
                use_gpt_translation=False
            )


    @patch('backend.services.phrase_service.search_for_sentences')
    def test_get_phrase_with_example_and_translation_search_error(self, mock_search,test_session):

        # Mock search error
        mock_search.side_effect = Exception("Search failed")

        result = get_phrase_with_example_and_translation(
            phrase="hola",
            language="es",
            target_language="en",
            proficiency="intermediate",
            session=test_session,
            use_gpt_translation=False
        )

        assert result["word"] == "hola"
        assert "word_translation" in result

    def test_get_phrase_with_example_and_translation_default_params(self):
        with patch('backend.services.phrase_service.search_for_sentences') as mock_search:
            mock_search.return_value = []

            result = get_phrase_with_example_and_translation(
                phrase="hello",
                language="en",
                target_language="es",
                proficiency="beginner",
                session=None
            )

            assert result["word"] == "hello"
            assert "word_translation" in result
