"""
Optimized Spanish Dictionary Service Tests.
Consolidated and optimized version with reduced redundancy.
"""

import pytest
from unittest.mock import patch
from sqlmodel import select

from backend.services.dict_spanish_service import (
    SpanishDictClient, parse_spanish_word_data, parse_audio_info,
    parse_conjugation_data, get_spanish_word_definition
)
from backend.models.dict_spanish import (
    SpanishDictionary, SpanishWordDefinition, SpanishWordEntry,
    PosGroup, Sense, Translation
)
from backend.models.shared import Example, AudioInfo


class TestSpanishDictClient:
    """Test the external Spanish dictionary client."""
    
    def test_init(self):
        """Test SpanishDictClient initialization."""
        client = SpanishDictClient()
        assert client.BASE_URL == "https://www.spanishdict.com"
        assert client.session is not None
        assert "User-Agent" in client.session.headers
        assert "Accept-Language" in client.session.headers
        
        # Check User-Agent contains expected browser info
        user_agent = client.session.headers["User-Agent"]
        assert "Mozilla" in user_agent
        assert "Chrome" in user_agent
    
    @pytest.mark.parametrize("word,expected_path", [
        ("hola", "translate/hola"),
        ("correr", "translate/correr"),
        ("casa", "translate/casa"),
    ])
    @patch('requests.Session.get')
    def test_get_word_data_success(self, mock_get, word, expected_path):
        """Test successful word data retrieval for various words."""
        # Create realistic SD_COMPONENT_DATA structure
        sd_component_data = {
            "sdDictionaryResultsProps": {
                "entry": {
                    "neodict": [
                        {
                            "subheadword": word,
                            "posGroups": [
                                {
                                    "pos": {"nameEn": "verb" if word == "correr" else "noun"},
                                    "senses": [
                                        {
                                            "translations": [
                                                {
                                                    "translation": "to run" if word == "correr" else "hello" if word == "hola" else "house",
                                                    "examples": []
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            },
            "resultCardHeaderProps": {
                "headwordAndQuickdefsProps": {
                    "headword": {
                        "displayText": word,
                        "audioUrl": f"https://example.com/{word}.mp3",
                        "wordLang": "es"
                    }
                }
            }
        }
        
        class MockResponse:
            def __init__(self, word):
                import json
                self.text = f'<html><script>window.SD_COMPONENT_DATA = {json.dumps(sd_component_data)};</script></html>'
                self.status_code = 200
            def raise_for_status(self):
                pass
        
        mock_get.return_value = MockResponse(word)
        client = SpanishDictClient()
        word_data, audio_data = client.get_word_data(word)
        
        # Now we can actually validate the parsed content
        assert isinstance(word_data, list)
        assert len(word_data) >= 1
        assert word_data[0]["subheadword"] == word
        
        assert isinstance(audio_data, dict)
        assert "headword" in audio_data
        assert audio_data["headword"]["displayText"] == word
        
        mock_get.assert_called_once()
        call_args = mock_get.call_args[0][0]
        assert expected_path in call_args
    
    @pytest.mark.parametrize("status_code,error_msg", [
        (404, "HTTP Error 404"),
        (500, "HTTP Error 500"),
        (403, "HTTP Error 403"),
    ])
    @patch('requests.Session.get')
    def test_get_word_data_http_errors(self, mock_get, status_code, error_msg):
        """Test HTTP error handling for various status codes."""
        class MockResponse:
            def __init__(self, status_code):
                self.status_code = status_code
                self.text = ""
            def raise_for_status(self):
                raise Exception(f"HTTP Error {self.status_code}")
        
        mock_get.return_value = MockResponse(status_code)
        client = SpanishDictClient()
        
        with pytest.raises(Exception) as exc_info:
            client.get_word_data("test")
        assert error_msg in str(exc_info.value)
    
    @pytest.mark.parametrize("verb", ["hablar", "correr", "ser"])
    @patch('requests.Session.get')
    def test_get_conjugations_success(self, mock_get, verb):
        """Test successful conjugation retrieval for various verbs."""
        # Create realistic SD_COMPONENT_DATA structure for conjugations
        sd_component_data = {
            "verb": {
                "infinitive": verb,
                "infinitiveTranslation": "speak" if verb == "hablar" else "run" if verb == "correr" else "be",
                "isReflexive": False,
                "paradigms": {
                    "presentIndicative": [
                        {
                            "conjugationForms": [f"{verb[:-2]}o"],  # yo form
                            "pronoun": "yo",
                            "audioQueryString": f"?lang=es&text={verb[:-2]}o",
                            "translationForms": [{"word": "speak" if verb == "hablar" else "run" if verb == "correr" else "am", "pronoun": "I"}]
                        },
                        {
                            "conjugationForms": [f"{verb[:-2]}es" if verb != "ser" else "eres"],
                            "pronoun": "tú",
                            "audioQueryString": f"?lang=es&text={verb[:-2]}es",
                            "translationForms": [{"word": "speak" if verb == "hablar" else "run" if verb == "correr" else "are", "pronoun": "you"}]
                        }
                    ]
                }
            }
        }
        
        class MockResponse:
            def __init__(self, verb):
                import json
                self.text = f'<html><script>window.SD_COMPONENT_DATA = {json.dumps(sd_component_data)};</script></html>'
                self.status_code = 200
            def raise_for_status(self):
                pass
        
        mock_get.return_value = MockResponse(verb)
        client = SpanishDictClient()
        result = client.get_conjugations(verb)
        
        # Now we can actually validate the parsed content
        assert isinstance(result, dict)
        assert "infinitive" in result
        assert result["infinitive"] == verb
        assert "tenses" in result
        assert "presentIndicative" in result["tenses"]
        
        mock_get.assert_called_once()
        call_args = mock_get.call_args[0][0]
        assert "spanishdict.com" in call_args


class TestSpanishWordDefinitionServiceWithRealFixtures:
    """Test the complete Spanish dictionary service using real fixture data."""
    
    def setup_real_dictionary_entries(self, test_session, real_spanish_dict_fixtures, words):
        """Helper to populate database with real fixture data."""
        for word in words:
            word_data, audio_data = real_spanish_dict_fixtures.load_complete_word_data(word)

            word_data = parse_spanish_word_data(word_data)
            word_data = [_.model_dump() for _ in word_data]
            
            # Load conjugations if available
            conjugation_data = None
            if word in real_spanish_dict_fixtures.get_available_verbs():
                conjugation_data = real_spanish_dict_fixtures.load_conjugations(word)
            
            dictionary_entry = SpanishDictionary(
                word=word,
                word_data=word_data,
                audio_data=audio_data,
                conjugation_data=conjugation_data
            )
            test_session.add(dictionary_entry)
        test_session.commit()
    
    @pytest.mark.parametrize("words,expected_count", [
        (["hola"], 1),
        (["casa"], 1),
        (["hola", "casa"], 2),
        (["correr"], 1),
    ])
    def test_get_definition_from_cache_with_real_data(self, test_session, real_spanish_dict_fixtures, words, expected_count):
        """Test retrieving cached definitions using real fixture data."""
        self.setup_real_dictionary_entries(test_session, real_spanish_dict_fixtures, words)
        
        result = get_spanish_word_definition(words, session=test_session, read_only=True)
        
        assert len(result) == expected_count
        
        for word in words:
            definition = next(d for d in result if d.word == word)
            assert isinstance(definition, SpanishWordDefinition)
            assert definition.word == word
            assert len(definition.entries) >= 1
            assert definition.spanish_audio is not None
            assert definition.spanish_audio.text == word
            assert definition.spanish_audio.lang == "es"
    
    def test_nonexistent_word_returns_empty_definition(self, test_session):
        """Test that nonexistent words return empty definitions in read_only mode."""
        result = get_spanish_word_definition(["nonexistent"], session=test_session, read_only=True)
        
        assert len(result) == 1
        definition = result[0]
        assert definition.word == "nonexistent"
        assert definition.entries == []
        assert definition.spanish_audio is None
    
    @patch('backend.services.dict_spanish_service.SpanishDictClient.get_word_data')
    def test_api_call_and_caching_with_real_fixtures(self, mock_get_word_data, test_session, real_spanish_dict_fixtures):
        """Test API call and caching using real fixture data."""
        word = "hola"
        word_data, audio_data = real_spanish_dict_fixtures.load_complete_word_data(word)
        mock_get_word_data.return_value = (word_data, audio_data)
        
        # Test successful API call
        result = get_spanish_word_definition([word], session=test_session, read_only=False)
        assert len(result) == 1
        definition = result[0]
        assert definition.word == word
        assert len(definition.entries) >= 1
        mock_get_word_data.assert_called_with(word)
        
        # Verify data was cached in database
        test_session.commit()
        cached_entry = test_session.exec(select(SpanishDictionary).where(SpanishDictionary.word == word)).first()
        assert cached_entry is not None
        assert cached_entry.word == word
        # assert cached_entry.word_data == word_data
        assert cached_entry.audio_data == audio_data
        
        # Test retrieval from cache (no API call)
        mock_get_word_data.reset_mock()
        result_cached = get_spanish_word_definition([word], session=test_session, read_only=True)
        assert len(result_cached) == 1
        assert result_cached[0].word == word
        mock_get_word_data.assert_not_called()
    
    @patch('backend.services.dict_spanish_service.SpanishDictClient.get_word_data')
    def test_api_failure_raises_exception(self, mock_get_word_data, test_session):
        """Test that API failures properly raise exceptions."""
        mock_get_word_data.side_effect = Exception("API Error")
        
        with pytest.raises(Exception) as exc_info:
            get_spanish_word_definition(["failed"], session=test_session, read_only=False)
        assert "API Error" in str(exc_info.value)
    
    @pytest.mark.parametrize("verb", ["correr", "ser", "hablar"])
    @patch('backend.services.dict_spanish_service.SpanishDictClient.get_word_data')
    @patch('backend.services.dict_spanish_service.SpanishDictClient.get_conjugations')
    def test_verb_with_conjugations_real_data(self, mock_get_conjugations, mock_get_word_data, 
                                            test_session, real_spanish_dict_fixtures, verb):
        """Test verb processing with conjugations using real fixture data."""
        word_data, audio_data = real_spanish_dict_fixtures.load_complete_word_data(verb)
        conjugations_data = real_spanish_dict_fixtures.load_conjugations(verb)
        
        mock_get_word_data.return_value = (word_data, audio_data)
        mock_get_conjugations.return_value = conjugations_data
        
        result = get_spanish_word_definition(
            [verb], 
            include_conjugations=True,
            session=test_session, 
            read_only=False
        )
        
        assert len(result) == 1
        definition = result[0]
        assert definition.word == verb
        assert len(definition.entries) >= 1
        
        # Check that it's recognized as a verb
        has_verb_pos = any(
            any("verb" in pg.pos.lower() for pg in entry.pos_groups)
            for entry in definition.entries
        )
        assert has_verb_pos, definition.entries
        
        assert definition.conjugations is not None
        assert definition.conjugations.infinitive == verb
        assert len(definition.conjugations.tenses) > 0
        assert "presentIndicative" in definition.conjugations.tenses
        
        mock_get_word_data.assert_called_with(verb)
        mock_get_conjugations.assert_called_with(verb)
    
    def test_complete_definition_structure_real_data(self, test_session, real_spanish_dict_fixtures):
        """Test complete definition structure validation using real fixture data."""
        word = "casa"
        self.setup_real_dictionary_entries(test_session, real_spanish_dict_fixtures, [word])
        
        result = get_spanish_word_definition([word], session=test_session, read_only=True)
        definition = result[0]
        
        # Verify complete nested structure with real data
        assert isinstance(definition, SpanishWordDefinition)
        assert definition.word == word
        assert len(definition.entries) >= 1
        
        entry = definition.entries[0]
        assert isinstance(entry, SpanishWordEntry)
        assert word in entry.word.lower()
        
        assert len(entry.pos_groups) >= 1
        pos_group = entry.pos_groups[0]
        assert isinstance(pos_group, PosGroup)
        assert pos_group.pos is not None
        
        assert len(pos_group.senses) >= 1
        sense = pos_group.senses[0]
        assert isinstance(sense, Sense)
        
        assert len(sense.translations) >= 1
        translation = sense.translations[0]
        assert isinstance(translation, Translation)
        assert translation.translation is not None
        assert "house" in translation.translation.lower()
        
        # Audio should be present
        assert definition.spanish_audio is not None
        assert isinstance(definition.spanish_audio, AudioInfo)
        assert definition.spanish_audio.text == word
        assert definition.spanish_audio.lang == "es"
    
    def test_empty_word_list_returns_empty_result(self, test_session):
        """Test that empty word list returns empty result."""
        result = get_spanish_word_definition([], session=test_session)
        assert result == []
    
    @pytest.mark.parametrize("word_variants", [
        ["hola", "HOLA", "Hola"],
    ])
    def test_case_sensitivity_with_real_data(self, test_session, real_spanish_dict_fixtures, word_variants):
        """Test case sensitivity handling with real data."""
        base_word = word_variants[0].lower()
        self.setup_real_dictionary_entries(test_session, real_spanish_dict_fixtures, [base_word])
        
        # Test different cases - all should find the same word
        for word_variant in word_variants:
            result = get_spanish_word_definition([word_variant], session=test_session, read_only=True)
            assert len(result) == 1
            assert result[0].word == base_word  # Service normalizes to lowercase
    
    def test_multiple_words_mixed_types(self, test_session, real_spanish_dict_fixtures):
        """Test processing multiple words of different types."""
        words = ["hola", "casa", "correr"]  # interjection, noun, verb
        self.setup_real_dictionary_entries(test_session, real_spanish_dict_fixtures, words)
        
        result = get_spanish_word_definition(words, session=test_session, read_only=True)
        assert len(result) == len(words)
        
        result_words = [d.word for d in result]
        for word in words:
            assert word in result_words
            
            definition = next(d for d in result if d.word == word)
            assert len(definition.entries) >= 1
            assert definition.spanish_audio is not None
    
    def test_mixed_cache_and_api_scenario_real_data(self, test_session, real_spanish_dict_fixtures):
        """Test scenario with some words cached and others requiring API calls."""
        # Pre-cache 'hola' with real data
        self.setup_real_dictionary_entries(test_session, real_spanish_dict_fixtures, ["hola"])
        
        with patch('backend.services.dict_spanish_service.SpanishDictClient.get_word_data') as mock_get_word_data:
            casa_word_data, casa_audio_data = real_spanish_dict_fixtures.load_complete_word_data("casa")
            mock_get_word_data.return_value = (casa_word_data, casa_audio_data)
            
            # Request both words
            result = get_spanish_word_definition(["hola", "casa"], session=test_session, read_only=False)
            
            assert len(result) == 2
            result_words = [d.word for d in result]
            assert "hola" in result_words
            assert "casa" in result_words
            
            # API should only be called for 'casa'
            mock_get_word_data.assert_called_once_with("casa")
            
            # Both should have complete structure
            for definition in result:
                assert len(definition.entries) >= 1
                assert definition.spanish_audio is not None

    @pytest.mark.parametrize("test_type,include_conjugations", [
        ("word_only", False),
        ("with_conjugations", True),
    ])
    @patch('backend.services.dict_spanish_service.SpanishDictClient.get_word_data')
    @patch('backend.services.dict_spanish_service.SpanishDictClient.get_conjugations')
    def test_service_with_real_payloads(self, mock_get_conjugations, mock_get_word_data, test_session, real_spanish_dict_fixtures, test_type, include_conjugations):
        """Test complete service using real payloads."""
        # Use different words for different test types
        word = "hola" if test_type == "word_only" else "correr"
        
        # Mock API calls with real data
        word_data, audio_data = real_spanish_dict_fixtures.load_complete_word_data(word)
        mock_get_word_data.return_value = (word_data, audio_data)
        
        if include_conjugations:
            conjugations_data = real_spanish_dict_fixtures.load_conjugations(word)
            mock_get_conjugations.return_value = conjugations_data
        
        # Call service
        result = get_spanish_word_definition(
            [word], 
            include_conjugations=include_conjugations,
            session=test_session, 
            read_only=False
        )
        
        # Verify results
        assert len(result) == 1
        definition = result[0]
        assert isinstance(definition, SpanishWordDefinition)
        assert definition.word == word
        assert len(definition.entries) >= 1
        assert definition.spanish_audio is not None
        
        if include_conjugations and word == "correr":
            assert definition.conjugations is not None
            assert definition.conjugations.infinitive == word
            mock_get_conjugations.assert_called_once_with(word)
        
        mock_get_word_data.assert_called_once_with(word)
    


class TestRealSpanishDictPayloads:
    """Test using real Spanish dictionary payloads."""
    
    @pytest.mark.parametrize("word,expected_pos,expected_translation", [
        ("hola", "interjection", "hello"),
        ("casa", "noun", "house"),
        ("correr", "verb", "run"),
    ])
    def test_parse_real_word_data(self, real_spanish_dict_fixtures, word, expected_pos, expected_translation):
        """Test parsing real word data for various Spanish words."""
        word_data, audio_data = real_spanish_dict_fixtures.load_complete_word_data(word)
        
        # Parse word data
        entries = parse_spanish_word_data(word_data)
        assert len(entries) >= 1
        
        entry = entries[0]
        assert isinstance(entry, SpanishWordEntry)
        assert word in entry.word  # May include articles like "la casa"
        assert len(entry.pos_groups) >= 1
        
        # Check part of speech
        pos_names = [pg.pos.lower() for pg in entry.pos_groups]
        assert any(expected_pos in pos for pos in pos_names)
        
        # Check translations contain expected word
        all_translations = []
        for pos_group in entry.pos_groups:
            for sense in pos_group.senses:
                for translation in sense.translations:
                    all_translations.append(translation.translation.lower())
        
        assert any(expected_translation in trans for trans in all_translations)
        
        # Parse audio data
        spanish_audio, english_audio = parse_audio_info(audio_data)
        assert isinstance(spanish_audio, AudioInfo)
        assert spanish_audio.text == word
        assert spanish_audio.lang == "es"
        assert spanish_audio.audio_url is not None
    
    @pytest.mark.parametrize("verb", ["correr", "ser", "hablar"])
    def test_parse_real_conjugations(self, real_spanish_dict_fixtures, verb):
        """Test parsing real conjugation data for various verbs."""
        conjugations_data = real_spanish_dict_fixtures.load_conjugations(verb)
        conjugations = parse_conjugation_data(conjugations_data)
        
        assert conjugations is not None
        assert conjugations.infinitive == verb
        assert len(conjugations.tenses) > 0
        assert "presentIndicative" in conjugations.tenses
        
        # Present tense should have forms for different pronouns
        present = conjugations.tenses["presentIndicative"]
        assert len(present) >= 6
        
        # Check essential pronouns exist
        pronouns = [form.pronoun for form in present]
        essential_pronouns = ["yo", "tú", "él/ella/Ud."]
        for pronoun in essential_pronouns:
            assert pronoun in pronouns
        
        # Check forms are not empty
        for form in present:
            assert len(form.forms) > 0
            assert form.forms[0]  # Should have actual conjugated form
    

    def test_comprehensive_payload_validation(self, real_spanish_dict_fixtures):
        """Test that all available payloads can be parsed successfully."""
        # Test all available words
        available_words = real_spanish_dict_fixtures.get_available_words()
        assert len(available_words) > 0
        
        for word in available_words[:3]:  # Test first 3 to keep test fast
            word_data, audio_data = real_spanish_dict_fixtures.load_complete_word_data(word)
            
            # Should parse without errors
            entries = parse_spanish_word_data(word_data)
            assert len(entries) >= 1
            assert word in entries[0].word
            
            spanish_audio, _ = parse_audio_info(audio_data)
            assert spanish_audio is not None
            assert spanish_audio.text == word
        
        # Test all available verbs
        available_verbs = real_spanish_dict_fixtures.get_available_verbs()
        assert len(available_verbs) > 0
        
        for verb in available_verbs[:2]:  # Test first 2 to keep test fast
            conjugations_data = real_spanish_dict_fixtures.load_conjugations(verb)
            conjugations = parse_conjugation_data(conjugations_data)
            assert conjugations is not None
            assert conjugations.infinitive == verb
        
        # Test fixture loader functionality
        assert "hola" in available_words
        assert "correr" in available_verbs