import pytest
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch
from sqlmodel import Session

from backend.services.sentence.sentence_retriever import quick_tokenize, SentenceRetriever
from backend.services.sentence.db_models import Text, Phrase, Word


class TestQuickTokenize:
    
    def test_simple_text(self):
        result = quick_tokenize("Hello world")
        # The actual function returns lowercase tokens and filters punctuation
        assert result == ["hello", "world"]
    
    def test_text_with_punctuation(self):
        result = quick_tokenize("Hello, world!")
        # The actual function filters out punctuation
        assert result == ["hello", "world"]
    
    def test_text_with_numbers(self):
        result = quick_tokenize("I have 5 cats and 10 dogs")
        # The actual function returns lowercase
        assert result == ["i", "have", "5", "cats", "and", "10", "dogs"]
    
    def test_empty_text(self):
        result = quick_tokenize("")
        assert result == []
    
    def test_whitespace_only(self):
        result = quick_tokenize("   \n\t  ")
        assert result == []


class TestSentenceRetriever:
    
    @pytest.fixture
    def test_session(self, test_engine):
        """Create a test database session with sample data."""
        with Session(test_engine) as session:
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
            text3 = Text(
                id=3,
                title="Spanish Text",
                language="es", 
                category="fiction",
                source="test"
            )
            
            session.add_all([text1, text2, text3])
            session.commit()
            session.refresh(text1)
            session.refresh(text2)
            session.refresh(text3)
            
            # Create sample phrases - using longer, more natural sentences for better GDEX scores
            phrases = [
                Phrase(id=1, text="Hello world and welcome to our wonderful program", language="en", text_id=text1.id),
                Phrase(id=2, text="This is a simple test that demonstrates basic functionality", language="en", text_id=text1.id),
                Phrase(id=3, text="The quick brown fox jumps over the lazy dog", language="en", text_id=text2.id),
                Phrase(id=4, text="Hello there friend how are you doing today", language="en", text_id=text2.id),
                Phrase(id=5, text="Good morning everyone and have a great day", language="en", text_id=text2.id),
                Phrase(id=6, text="Hola mundo y bienvenidos a nuestro programa", language="es", text_id=text3.id),
                Phrase(id=7, text="Buenos días a todos y que tengan buen día", language="es", text_id=text3.id),
            ]
            
            session.add_all(phrases)
            session.commit()
            
            # Create sample words
            words = [
                Word(text="hello", lemma="hello", pos="INTJ", tag="UH", phrase_id=1, text_id=text1.id),
                Word(text="world", lemma="world", pos="NOUN", tag="NN", phrase_id=1, text_id=text1.id),
                Word(text="this", lemma="this", pos="PRON", tag="DT", phrase_id=2, text_id=text1.id),
                Word(text="is", lemma="be", pos="AUX", tag="VBZ", phrase_id=2, text_id=text1.id),
                Word(text="simple", lemma="simple", pos="ADJ", tag="JJ", phrase_id=2, text_id=text1.id),
                Word(text="test", lemma="test", pos="NOUN", tag="NN", phrase_id=2, text_id=text1.id),
            ]
            
            session.add_all(words)
            session.commit()
            
            yield session
    
    @pytest.fixture
    def temp_index_dir(self):
        """Create a temporary directory for index files."""
        temp_dir = tempfile.mkdtemp()
        yield Path(temp_dir)
        shutil.rmtree(temp_dir)
    
    def test_init(self):
        """Test SentenceRetriever initialization."""
        retriever = SentenceRetriever("intermediate")
        assert retriever.user_proficiency == "intermediate"
        assert hasattr(retriever, 'gdex_scorers')
        assert hasattr(retriever, 'index_data')
        assert hasattr(retriever, 'index_paths')
    
    def test_init_with_different_proficiency(self):
        """Test initialization with different proficiency levels."""
        retriever = SentenceRetriever("advanced")
        assert retriever.user_proficiency == "advanced"
        
        retriever = SentenceRetriever("beginner")
        assert retriever.user_proficiency == "beginner"
    
    def test_build_sentence_index_full(self, test_engine, test_session, temp_index_dir):
        """Test full sentence index building with real database."""
        # Patch the engine and INDEX_DIR to use our test versions
        with patch('backend.services.sentence.sentence_retriever.engine', test_engine):
            with patch('backend.services.sentence.sentence_retriever.INDEX_DIR', temp_index_dir):
                retriever = SentenceRetriever("intermediate")
                
                # Build index for English
                index_path = temp_index_dir / "sentence_index_en.pkl"
                result = retriever.build_sentence_index("en", index_path)
                
                # Verify index structure
                assert isinstance(result, dict)
                assert "phrase_id2idx" in result
                assert "texts" in result
                assert "tokenized_texts" in result
                assert "token_to_phrases" in result
                assert "metadata" in result
                
                # Verify content
                assert len(result["texts"]) >= 5  # We have 5 English phrases
                assert len(result["phrase_id2idx"]) >= 5
                assert len(result["metadata"]) >= 5
                
                # Check that tokenization worked
                assert len(result["tokenized_texts"]) == len(result["texts"])
                
                # Check token mapping
                assert "hello" in result["token_to_phrases"]
                assert "world" in result["token_to_phrases"]
                assert "test" in result["token_to_phrases"]
                
                # Verify index file was created
                assert index_path.exists()
    
    def test_build_sentence_index_spanish(self, test_engine, test_session, temp_index_dir):
        """Test building index for Spanish language."""
        with patch('backend.services.sentence.sentence_retriever.engine', test_engine):
            with patch('backend.services.sentence.sentence_retriever.INDEX_DIR', temp_index_dir):
                retriever = SentenceRetriever("intermediate")
                
                # Build index for Spanish
                index_path = temp_index_dir / "sentence_index_es.pkl"
                result = retriever.build_sentence_index("es", index_path)
                
                # Verify Spanish content
                assert isinstance(result, dict)
                assert len(result["texts"]) >= 2  # We have 2 Spanish phrases
                
                # Check Spanish tokens
                assert "hola" in result["token_to_phrases"]
                assert "mundo" in result["token_to_phrases"]
    
    def test_build_sentence_index_empty_language(self, test_engine, test_session, temp_index_dir):
        """Test building index for language with no data."""
        with patch('backend.services.sentence.sentence_retriever.engine', test_engine):
            with patch('backend.services.sentence.sentence_retriever.INDEX_DIR', temp_index_dir):
                retriever = SentenceRetriever("intermediate")
                
                # Build index for non-existent language
                index_path = temp_index_dir / "sentence_index_fr.pkl"
                result = retriever.build_sentence_index("fr", index_path)
                
                # Should return empty dict
                assert result == {}
    
    def test_get_best_examples_full(self, test_engine, test_session, temp_index_dir):
        """Test full get_best_examples functionality with real data."""
        # The test_session fixture creates the data we need
        with patch('backend.services.sentence.sentence_retriever.engine', test_engine):
            with patch('backend.services.sentence.sentence_retriever.INDEX_DIR', temp_index_dir):
                retriever = SentenceRetriever("intermediate")
                
                # Build the index first
                index_path = temp_index_dir / "sentence_index_en.pkl"
                retriever.build_sentence_index("en", index_path)
                
                # Load the built index
                retriever.load_existing_indexes()
                
                # Mock GDEX scorer to return acceptable scores for testing
                mock_scores = {'length': 0.8, 'target_position': 0.8, 'total': 0.8}
                with patch.object(retriever.gdex_scorers['en'], 'score_sentence', return_value=mock_scores):
                    # Test searching for "hello"
                    results = retriever.get_best_examples("hello", "en", 3)
                    
                    # Verify results structure
                    assert isinstance(results, list)
                    assert len(results) >= 1  # Should find at least one match
                    
                    # Check result format
                    if results:
                        result = results[0]
                        assert "sentence" in result
                        assert "score" in result
                        assert "text_id" in result
                        assert "title" in result
                        assert "category" in result
                        
                        # Should find sentences containing "hello"
                        found_hello = any("hello" in r["sentence"].lower() for r in results)
                        assert found_hello
    
    def test_get_best_examples_multiple_matches(self, test_engine, test_session, temp_index_dir):
        """Test getting multiple examples with scoring."""
        with patch('backend.services.sentence.sentence_retriever.engine', test_engine):
            with patch('backend.services.sentence.sentence_retriever.INDEX_DIR', temp_index_dir):
                retriever = SentenceRetriever("intermediate")
                
                # Build and load index
                index_path = temp_index_dir / "sentence_index_en.pkl"
                retriever.build_sentence_index("en", index_path)
                retriever.load_existing_indexes()
                
                # Mock GDEX scorer to return acceptable scores for testing
                mock_scores = {'length': 0.75, 'target_position': 0.8, 'total': 0.75}
                with patch.object(retriever.gdex_scorers['en'], 'score_sentence', return_value=mock_scores):
                    # Search for a common word that should appear in multiple sentences
                    results = retriever.get_best_examples("test", "en", 5)
                    
                    # Verify results
                    assert isinstance(results, list)
                    
                    if results:
                        # Results should be sorted by score (highest first)
                        scores = [r["score"] for r in results]
                        assert scores == sorted(scores, reverse=True)
                        
                        # All results should contain the search term
                        for result in results:
                            assert "test" in result["sentence"].lower()
    
    def test_get_best_examples_no_matches(self, test_engine, test_session, temp_index_dir):
        """Test searching for term with no matches."""
        with patch('backend.services.sentence.sentence_retriever.engine', test_engine):
            with patch('backend.services.sentence.sentence_retriever.INDEX_DIR', temp_index_dir):
                retriever = SentenceRetriever("intermediate")
                
                # Build and load index
                index_path = temp_index_dir / "sentence_index_en.pkl"
                retriever.build_sentence_index("en", index_path)
                retriever.load_existing_indexes()
                
                # Search for non-existent term
                results = retriever.get_best_examples("xyznonexistent", "en", 5)
                
                assert results == []
    
    def test_get_best_examples_unsupported_language(self, test_engine, test_session, temp_index_dir):
        """Test searching in unsupported language."""
        with patch('backend.services.sentence.sentence_retriever.engine', test_engine):
            with patch('backend.services.sentence.sentence_retriever.INDEX_DIR', temp_index_dir):
                retriever = SentenceRetriever("intermediate")
                
                # Try to search without building an index
                results = retriever.get_best_examples("test", "fr", 5)
                
                assert results == []
    
    def test_add_phrase_to_index_real(self, test_engine, test_session, temp_index_dir):
        """Test adding new phrase to existing index with real objects."""
        with patch('backend.services.sentence.sentence_retriever.engine', test_engine):
            with patch('backend.services.sentence.sentence_retriever.INDEX_DIR', temp_index_dir):
                retriever = SentenceRetriever("intermediate")
                
                # Build initial index
                index_path = temp_index_dir / "sentence_index_en.pkl"
                retriever.build_sentence_index("en", index_path)
                retriever.load_existing_indexes()
                
                # Get initial count
                initial_count = len(retriever.index_data["en"]["texts"])
                
                # Create new text and phrase
                new_text = Text(
                    id=99,
                    title="New Test Text",
                    language="en",
                    category="test",
                    source="manual"
                )
                
                new_phrase = Phrase(
                    id=99,
                    text="This is a brand new sentence for testing our search functionality",
                    language="en",
                    text_id=99
                )
                
                # Add to index
                retriever.add_phrase_to_index(new_text, new_phrase, "en")
                
                # Verify addition
                assert len(retriever.index_data["en"]["texts"]) == initial_count + 1
                assert "brand" in retriever.index_data["en"]["token_to_phrases"]
                assert 99 in retriever.index_data["en"]["phrase_id2idx"]
                assert 99 in retriever.index_data["en"]["metadata"]
    
    def test_load_existing_indexes_creates_missing(self, test_engine, test_session, temp_index_dir):
        """Test that load_existing_indexes creates indexes when they don't exist."""
        with patch('backend.services.sentence.sentence_retriever.engine', test_engine):
            with patch('backend.services.sentence.sentence_retriever.INDEX_DIR', temp_index_dir):
                retriever = SentenceRetriever("intermediate")
                
                # Load indexes (should build them since they don't exist)
                retriever.load_existing_indexes()
                
                # Should have created English index
                assert "en" in retriever.index_data
                assert len(retriever.index_data["en"]["texts"]) >= 5
    
    def test_score_word_position(self):
        """Test word position scoring algorithm."""
        retriever = SentenceRetriever("intermediate")
        
        # Test position scoring
        score1 = retriever._score_word_position("Hello world test", "world")
        score2 = retriever._score_word_position("Test world hello", "world")
        score3 = retriever._score_word_position("world", "world")
        
        # All scores should be valid floats between 0 and 1
        assert isinstance(score1, float)
        assert isinstance(score2, float)
        assert isinstance(score3, float)
        assert 0.0 <= score1 <= 1.0
        assert 0.0 <= score2 <= 1.0
        assert 0.0 <= score3 <= 1.0
        
        # Single word should get highest score
        assert score3 >= score1
        assert score3 >= score2
    
    def test_full_workflow_integration(self, test_engine, test_session, temp_index_dir):
        """Test the complete workflow from index building to search."""
        with patch('backend.services.sentence.sentence_retriever.engine', test_engine):
            with patch('backend.services.sentence.sentence_retriever.INDEX_DIR', temp_index_dir):
                # Initialize retriever
                retriever = SentenceRetriever("intermediate")
                
                # Step 1: Build indexes
                retriever.load_existing_indexes()
                
                # Mock GDEX scorer to return acceptable scores for testing
                mock_scores = {'length': 0.8, 'target_position': 0.8, 'total': 0.8}
                with patch.object(retriever.gdex_scorers['en'], 'score_sentence', return_value=mock_scores):
                    # Step 2: Search for examples
                    hello_results = retriever.get_best_examples("hello", "en", 3)
                    test_results = retriever.get_best_examples("test", "en", 2)
                    
                    # Step 3: Verify search results
                    assert isinstance(hello_results, list)
                    assert isinstance(test_results, list)
                    
                    # Step 4: Add new content
                    new_text = Text(
                        id=100,
                        title="Dynamic Content",
                        language="en",
                        category="dynamic",
                        source="runtime"
                    )
                    
                    new_phrase = Phrase(
                        id=100,
                        text="Hello dynamic world with testing and comprehensive evaluation",
                        language="en", 
                        text_id=100
                    )
                    
                    retriever.add_phrase_to_index(new_text, new_phrase, "en")
                    
                    # Step 5: Search again and verify new content is found
                    updated_hello_results = retriever.get_best_examples("hello", "en", 5)
                    updated_test_results = retriever.get_best_examples("testing", "en", 3)
                    
                    # Should find the new sentence
                    found_dynamic = any("dynamic" in r["sentence"] for r in updated_hello_results)
                    found_testing = any("testing" in r["sentence"] for r in updated_test_results)
                    
                    assert found_dynamic
                    assert found_testing