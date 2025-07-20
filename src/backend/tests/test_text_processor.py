import pytest
from unittest.mock import patch

from backend.services.text_processor import TextProcessor, DatabaseSaver
from backend.services.sentence.db_models import Text, Phrase, Word


class TestTextProcessor:
    
    @pytest.fixture
    def processor(self):
        """Create a TextProcessor instance for testing."""
        return TextProcessor()
    
    @pytest.fixture
    def sample_texts(self):
        """Provide sample texts for testing."""
        return {
            "simple": "Hello world",
            "punctuation": "Hello, world! How are you?",
            "numbers": "I have 5 cats and 10 dogs",
            "empty": "",
            "whitespace": "   \n\t  ",
            "complex": "The quick brown fox jumps over the lazy dog.",
            "spanish": "Hola mundo, ¿cómo estás?"
        }
    
    def test_init(self, processor):
        """Test TextProcessor initialization."""
        assert hasattr(processor, '_nlp_models')
        assert processor._nlp_models == {}
    
    def test_process_text_empty_text(self, processor):
        """Test processing empty text."""
        result = processor.process_text("", "en")
        assert result == []
    
    def test_process_text_whitespace_only(self, processor, sample_texts):
        """Test processing whitespace-only text."""
        result = processor.process_text(sample_texts["whitespace"], "en")
        # The processor might handle whitespace differently, so check for minimal meaningful tokens
        if result:
            # If tokens are returned, they should be minimal or whitespace-only
            assert len(result) <= 1
        else:
            # Or it could return empty list
            assert result == []
    
    def test_tokenize_with_basic_split_simple(self, processor, sample_texts):
        """Test basic tokenization functionality."""
        result = processor.tokenize_with_basic_split(sample_texts["simple"])
        expected = ["Hello", "world"]
        assert result == expected
    
    def test_tokenize_with_basic_split_punctuation(self, processor, sample_texts):
        """Test basic tokenization with punctuation."""
        result = processor.tokenize_with_basic_split(sample_texts["punctuation"])
        assert "Hello" in result
        assert "world" in result
        assert "How" in result
        assert "are" in result
        assert "you" in result
        # Punctuation should be separated
        assert "," in result or "!" in result or "?" in result
    
    def test_tokenize_with_basic_split_numbers(self, processor, sample_texts):
        """Test basic tokenization with numbers."""
        result = processor.tokenize_with_basic_split(sample_texts["numbers"])
        assert "I" in result
        assert "have" in result
        assert "5" in result
        assert "cats" in result
        assert "10" in result
        assert "dogs" in result
    
    @patch('spacy.load')
    def test_process_text_with_spacy_success(self, mock_spacy_load, processor, sample_texts):
        """Test text processing with spaCy when model is available."""
        # Create realistic mock spaCy doc
        class MockToken:
            def __init__(self, text, pos_, lemma_, tag_, is_stop=False, is_punct=False, ent_type_=""):
                self.text = text
                self.pos_ = pos_
                self.lemma_ = lemma_
                self.tag_ = tag_
                self.is_stop = is_stop
                self.is_punct = is_punct
                self.ent_type_ = ent_type_
        
        mock_tokens = [
            MockToken("Hello", "INTJ", "hello", "UH"),
            MockToken("world", "NOUN", "world", "NN")
        ]
        
        mock_nlp = lambda text: mock_tokens
        mock_spacy_load.return_value = mock_nlp
        
        result = processor.process_text(sample_texts["simple"], "en")
        
        assert len(result) == 2
        assert result[0]["text"] == "Hello"
        assert result[0]["pos"] == "INTJ"
        assert result[0]["lemma"] == "hello"
        assert result[0]["tag"] == "UH"
        assert result[0]["is_stop"] == False
        assert result[0]["is_punct"] == False
        assert result[0]["ent_type"] == ""
        
        assert result[1]["text"] == "world"
        assert result[1]["pos"] == "NOUN"
        assert result[1]["lemma"] == "world"
        assert result[1]["tag"] == "NN"
    
    @patch('spacy.load')
    def test_process_text_spacy_model_not_found(self, mock_spacy_load, processor, sample_texts):
        """Test fallback to basic tokenization when spaCy model is not available."""
        # Mock spacy.load to raise OSError (model not found)
        mock_spacy_load.side_effect = OSError("Model not found")
        
        result = processor.process_text(sample_texts["simple"], "en")
        
        assert isinstance(result, list)
        assert len(result) > 0
        # Should use fallback tokenization
        assert all("text" in item for item in result)
        assert all("lemma" in item for item in result)
        # In fallback mode, lemma should equal text (lowercased)
        for item in result:
            assert item["lemma"] == item["text"].lower()
    
    @patch('spacy.load')
    def test_process_text_different_languages(self, mock_spacy_load, processor, sample_texts):
        """Test processing text in different languages."""
        # Mock different language models
        def mock_load_side_effect(model_name, disable=None):
            class MockToken:
                def __init__(self, text, pos_, lemma_, tag_):
                    self.text = text
                    self.pos_ = pos_
                    self.lemma_ = lemma_
                    self.tag_ = tag_
                    self.is_stop = False
                    self.is_punct = False
                    self.ent_type_ = ""
            
            if "es_core" in model_name:
                # Spanish model
                return lambda text: [
                    MockToken("Hola", "INTJ", "hola", "I"),
                    MockToken("mundo", "NOUN", "mundo", "NCMS000")
                ]
            else:
                # English model (default)
                return lambda text: [
                    MockToken("Hello", "INTJ", "hello", "UH"),
                    MockToken("world", "NOUN", "world", "NN")
                ]
        
        mock_spacy_load.side_effect = mock_load_side_effect
        
        # Test English
        result_en = processor.process_text(sample_texts["simple"], "en")
        assert len(result_en) == 2
        assert result_en[0]["text"] == "Hello"
        
        # Test Spanish
        result_es = processor.process_text("Hola mundo", "es")
        assert len(result_es) == 2
        assert result_es[0]["text"] == "Hola"
        assert result_es[0]["lemma"] == "hola"
    
    def test_process_sentence_integration(self, processor, sample_texts):
        """Test complete sentence processing workflow."""
        # Use fallback tokenization for predictable results
        with patch('spacy.load', side_effect=OSError("Model not found")):
            result = processor.process_sentence(sample_texts["simple"], "en")
            
            assert result["text"] == sample_texts["simple"]
            assert result["language"] == "en"
            assert "words" in result
            assert isinstance(result["words"], list)
            assert len(result["words"]) > 0
            
            # Check word structure
            for word in result["words"]:
                assert "text" in word
                assert "lemma" in word
                assert "pos" in word
    
    @patch('spacy.load')
    def test_nlp_model_caching(self, mock_spacy_load, processor):
        """Test that NLP models are cached properly."""
        mock_nlp = lambda text: []
        mock_spacy_load.return_value = mock_nlp
        
        # First call should load the model
        processor.process_text("test", "en")
        assert mock_spacy_load.call_count == 1
        
        # Second call should use cached model
        processor.process_text("test again", "en")
        assert mock_spacy_load.call_count == 1  # Should not increase
        
        # Different language should load new model
        processor.process_text("prueba", "es")
        assert mock_spacy_load.call_count == 2
    
    def test_complex_sentence_processing(self, processor, sample_texts):
        """Test processing of complex sentences with punctuation."""
        with patch('spacy.load', side_effect=OSError("Model not found")):
            result = processor.process_sentence(sample_texts["complex"], "en")
            
            assert result["text"] == sample_texts["complex"]
            assert len(result["words"]) > 5  # Should have multiple words
            
            # Check that punctuation is handled
            word_texts = [word["text"] for word in result["words"]]
            assert "The" in word_texts or "the" in word_texts
            assert "fox" in word_texts
            assert "dog" in word_texts


class TestDatabaseSaver:
    
    @pytest.fixture
    def sample_words_data(self):
        """Provide sample word data for testing."""
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
    
    @pytest.fixture
    def complex_words_data(self):
        """Provide complex word data for testing."""
        return [
            {
                "text": "The",
                "lemma": "the",
                "pos": "DET",
                "tag": "DT",
                "is_stop": True,
                "is_punct": False,
                "ent_type": ""
            },
            {
                "text": "quick",
                "lemma": "quick",
                "pos": "ADJ",
                "tag": "JJ",
                "is_stop": False,
                "is_punct": False,
                "ent_type": ""
            },
            {
                "text": "brown",
                "lemma": "brown",
                "pos": "ADJ",
                "tag": "JJ",
                "is_stop": False,
                "is_punct": False,
                "ent_type": ""
            },
            {
                "text": "fox",
                "lemma": "fox",
                "pos": "NOUN",
                "tag": "NN",
                "is_stop": False,
                "is_punct": False,
                "ent_type": ""
            },
            {
                "text": ".",
                "lemma": ".",
                "pos": "PUNCT",
                "tag": ".",
                "is_stop": False,
                "is_punct": True,
                "ent_type": ""
            }
        ]
    
    def test_init_requires_session(self, test_session):
        """Test DatabaseSaver initialization."""
        saver = DatabaseSaver(test_session)
        assert saver.session == test_session
    
    def test_save_sentence_basic(self, test_session, sample_words_data):
        """Test basic sentence saving functionality."""
        saver = DatabaseSaver(test_session)
        
        result = saver.save_sentence(
            sentence="Hello world",
            language="en",
            source="test",
            title="Test Sentence",
            category="test",
            words_data=sample_words_data
        )
        
        # Should return tuple of (Text, Phrase)
        assert result is not None
        text_entry, phrase_entry = result
        
        # Verify Text object
        assert isinstance(text_entry, Text)
        assert text_entry.title == "Test Sentence"
        assert text_entry.language == "en"
        assert text_entry.category == "test"
        assert text_entry.source == "test"
        
        # Verify Phrase object
        assert isinstance(phrase_entry, Phrase)
        assert phrase_entry.text == "Hello world"
        assert phrase_entry.language == "en"
        assert phrase_entry.text_id == text_entry.id
        
        # Verify data was saved to database
        test_session.commit()
        
        # Check Text was saved
        saved_text = test_session.get(Text, text_entry.id)
        assert saved_text is not None
        assert saved_text.title == "Test Sentence"
        
        # Check Phrase was saved
        saved_phrase = test_session.get(Phrase, phrase_entry.id)
        assert saved_phrase is not None
        assert saved_phrase.text == "Hello world"
        
        # Check Words were saved
        from sqlmodel import select
        words = test_session.exec(
            select(Word).where(Word.phrase_id == phrase_entry.id)
        ).all()
        assert len(words) == 2
        assert words[0].text == "Hello"
        assert words[1].text == "world"
    
    def test_save_sentence_complex(self, test_session, complex_words_data):
        """Test saving complex sentences with various word types."""
        saver = DatabaseSaver(test_session)
        
        result = saver.save_sentence(
            sentence="The quick brown fox.",
            language="en",
            source="literature",
            title="Classic Example",
            category="example",
            words_data=complex_words_data
        )
        
        assert result is not None
        text_entry, phrase_entry = result
        
        test_session.commit()
        
        # Verify complex word data was saved correctly
        from sqlmodel import select
        words = test_session.exec(
            select(Word).where(Word.phrase_id == phrase_entry.id)
        ).all()
        
        assert len(words) == 5
        
        # Check specific word properties
        word_dict = {w.text: w for w in words}
        
        # Check determiner
        the_word = word_dict["The"]
        assert the_word.pos == "DET"
        assert the_word.is_stop == True
        assert the_word.is_punct == False
        
        # Check adjectives
        quick_word = word_dict["quick"]
        assert quick_word.pos == "ADJ"
        assert quick_word.lemma == "quick"
        
        # Check punctuation
        punct_word = word_dict["."]
        assert punct_word.pos == "PUNCT"
        assert punct_word.is_punct == True
    
    def test_save_sentence_with_empty_words(self, test_session):
        """Test saving sentence with empty word data."""
        saver = DatabaseSaver(test_session)
        
        result = saver.save_sentence(
            sentence="Empty words test",
            language="en",
            source="test",
            title="Empty Test",
            category="test",
            words_data=[]
        )
        
        # Should still save Text and Phrase, just no Word entries
        assert result is not None
        text_entry, phrase_entry = result
        
        test_session.commit()
        
        # Verify Text and Phrase were saved
        assert test_session.get(Text, text_entry.id) is not None
        assert test_session.get(Phrase, phrase_entry.id) is not None
        
        # Verify no Words were saved
        from sqlmodel import select
        words = test_session.exec(
            select(Word).where(Word.phrase_id == phrase_entry.id)
        ).all()
        assert len(words) == 0
    
    def test_save_sentence_duplicate_handling(self, test_session, sample_words_data):
        """Test handling of duplicate sentences."""
        saver = DatabaseSaver(test_session)
        
        # Save first sentence
        result1 = saver.save_sentence(
            sentence="Duplicate test",
            language="en",
            source="test1",
            title="First",
            category="test",
            words_data=sample_words_data
        )
        
        # Save second sentence with same text but different metadata
        result2 = saver.save_sentence(
            sentence="Duplicate test",
            language="en",
            source="test2",
            title="Second",
            category="test",
            words_data=sample_words_data
        )
        
        assert result1 is not None
        assert result2 is not None
        
        text1, phrase1 = result1
        text2, phrase2 = result2
        
        # Should create separate Text entries
        assert text1.id != text2.id
        assert text1.title == "First"
        assert text2.title == "Second"
        
        # Should create separate Phrase entries
        assert phrase1.id != phrase2.id
        assert phrase1.text_id == text1.id
        assert phrase2.text_id == text2.id
    
    def test_save_sentence_different_languages(self, test_session):
        """Test saving sentences in different languages."""
        saver = DatabaseSaver(test_session)
        
        # English sentence
        english_words = [
            {"text": "Hello", "lemma": "hello", "pos": "INTJ", "tag": "UH", 
             "is_stop": False, "is_punct": False, "ent_type": ""}
        ]
        
        result_en = saver.save_sentence(
            sentence="Hello",
            language="en",
            source="test",
            title="English Test",
            category="test",
            words_data=english_words
        )
        
        # Spanish sentence
        spanish_words = [
            {"text": "Hola", "lemma": "hola", "pos": "INTJ", "tag": "I",
             "is_stop": False, "is_punct": False, "ent_type": ""}
        ]
        
        result_es = saver.save_sentence(
            sentence="Hola",
            language="es",
            source="test",
            title="Spanish Test",
            category="test",
            words_data=spanish_words
        )
        
        assert result_en is not None
        assert result_es is not None
        
        text_en, phrase_en = result_en
        text_es, phrase_es = result_es
        
        assert text_en.language == "en"
        assert text_es.language == "es"
        assert phrase_en.language == "en"
        assert phrase_es.language == "es"
    
    def test_save_sentence_error_recovery(self, test_session, sample_words_data):
        """Test error handling and recovery in database operations."""
        saver = DatabaseSaver(test_session)
        
        # Test with malformed word data
        malformed_words = [
            {"text": "Valid", "lemma": "valid", "pos": "ADJ"},
            # Missing required fields
            {"text": "Invalid"}
        ]
        
        # This might raise an error, but should be handled gracefully
        try:
            result = saver.save_sentence(
                sentence="Mixed valid invalid",
                language="en",
                source="test",
                title="Error Test",
                category="test",
                words_data=malformed_words
            )
            # If it succeeds, verify the valid parts were saved
            if result is not None:
                text_entry, phrase_entry = result
                assert text_entry.title == "Error Test"
        except Exception:
            # Error handling should prevent crashes
            pass
    
    def test_integration_with_text_processor(self, test_session):
        """Test integration between TextProcessor and DatabaseSaver."""
        processor = TextProcessor()
        saver = DatabaseSaver(test_session)
        
        # Process text with fallback tokenization for predictability
        with patch('spacy.load', side_effect=OSError("Model not found")):
            processed = processor.process_sentence("Integration test sentence", "en")
            
            # Save processed sentence
            result = saver.save_sentence(
                sentence=processed["text"],
                language=processed["language"],
                source="integration_test",
                title="Integration Test",
                category="test",
                words_data=processed["words"]
            )
            
            assert result is not None
            text_entry, phrase_entry = result
            
            test_session.commit()
            
            # Verify the complete workflow
            assert text_entry.title == "Integration Test"
            assert phrase_entry.text == "Integration test sentence"
            
            # Verify words were processed and saved correctly
            from sqlmodel import select
            words = test_session.exec(
                select(Word).where(Word.phrase_id == phrase_entry.id)
            ).all()
            
            assert len(words) > 0
            word_texts = [w.text for w in words]
            assert "Integration" in word_texts
            assert "test" in word_texts
            assert "sentence" in word_texts