import pytest
from unittest.mock import patch
from fastapi import HTTPException

from backend.services.notes_service import (
    create_note, get_note_list, get_note, delete_note, send_note_block
)
from backend.models.note import Note, NoteListResponse, NoteBlockCreate


class TestNotesService:
    """Test the notes service with real database operations."""
    
    
    def test_create_note_basic(self, test_session):
        """Test basic note creation functionality."""
        note = Note(name="Test Note", history={"content": []})
        
        result = create_note(test_session, note)
        
        # Verify note was created and returned
        assert result is not None
        assert isinstance(result, Note)
        assert result.name == "Test Note"
        assert result.history == {"content": []}
        assert result.id is not None
        
        # Verify note was saved to database
        saved_note = test_session.get(Note, result.id)
        assert saved_note is not None
        assert saved_note.name == "Test Note"
    
    def test_create_note_with_history(self, test_session):
        """Test creating note with initial history."""
        initial_history = {
            "content": [
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi! How can I help?"}
            ]
        }
        note = Note(name="Note with History", history=initial_history)
        
        result = create_note(test_session, note)
        
        assert result.history == initial_history
        assert len(result.history["content"]) == 2
        
        # Verify in database
        saved_note = test_session.get(Note, result.id)
        assert saved_note.history == initial_history
    
    def test_get_note_list_empty(self, test_session):
        """Test getting note list when no notes exist."""
        result = get_note_list(test_session)
        
        assert isinstance(result, list)
        assert len(result) == 0
    
    def test_get_note_list_with_notes(self, test_session, sample_notes):
        """Test getting note list with existing notes."""
        # Add sample notes to database
        for note in sample_notes:
            test_session.add(note)
        test_session.commit()
        
        result = get_note_list(test_session)
        
        assert isinstance(result, list)
        assert len(result) == 3
        
        # Verify all items are ChatListResponse objects
        for item in result:
            assert isinstance(item, NoteListResponse)
            assert hasattr(item, 'id')
            assert hasattr(item, 'name')
        
        # Verify specific notes are present
        note_names = [note.name for note in result]
        assert "English Practice" in note_names
        assert "Spanish Learning" in note_names
        assert "Empty Note" in note_names
    
    def test_get_note_exists(self, test_session, sample_notes):
        """Test retrieving existing note."""
        # Add a note to database
        note = sample_notes[0]
        test_session.add(note)
        test_session.commit()
        test_session.refresh(note)
        
        result = get_note(test_session, note.id)
        
        assert result is not None
        assert isinstance(result, Note)
        assert result.id == note.id
        assert result.name == "English Practice"
        assert len(result.history["content"]) == 2
    
    def test_get_note_not_found(self, test_session):
        """Test retrieving non-existent note."""
        with pytest.raises(HTTPException) as exc_info:
            get_note(test_session, 999)
        
        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Note not found"
    
    def test_delete_note_exists(self, test_session, sample_notes):
        """Test deleting existing note."""
        # Add a note to database
        note = sample_notes[0]
        test_session.add(note)
        test_session.commit()
        test_session.refresh(note)
        note_id = note.id
        
        result = delete_note(test_session, note_id)
        
        assert result == {'status': 'ok'}
        
        # Verify note was deleted from database
        deleted_note = test_session.get(Note, note_id)
        assert deleted_note is None
    
    def test_delete_note_not_found(self, test_session):
        """Test deleting non-existent note - should still return ok."""
        result = delete_note(test_session, 999)
        
        # Service returns ok even if note doesn't exist
        assert result == {'status': 'ok'}
    
    @patch('backend.services.notes_service.client')
    def test_send_note_block_regular_message_success(self, mock_client, test_session, sample_notes):
        """Test sending regular message and getting AI response."""
        # Add a note to database
        note = sample_notes[2]  # Empty note
        test_session.add(note)
        test_session.commit()
        test_session.refresh(note)
        
        # Mock AI client response
        class MockChunk:
            def __init__(self, content):
                self.choices = [type('obj', (object,), {
                    'delta': type('obj', (object,), {'content': content})()
                })()]
        
        mock_client.chat.completions.create.return_value = [
            MockChunk("Hello! "),
            MockChunk("How can I "),
            MockChunk("help you today?")
        ]
        
        message = NoteBlockCreate(block="Hello there", is_note=False)
        result = send_note_block(test_session, note.id, message)

        # Verify response structure
        assert result['status'] == 'ok'
        assert len(result['new_note_blocks']) == 2
        assert result['new_note_blocks'][1]['content'] == "Hello! How can I help you today?"
        
        # Verify AI client was called
        mock_client.chat.completions.create.assert_called_once()
        call_args = mock_client.chat.completions.create.call_args
        assert call_args[1]['stream'] == True
        
        # Verify note history was updated in database
        updated_note = test_session.get(Note, note.id)
        assert len(updated_note.history["content"]) == 2
        first_message = updated_note.history["content"][0]
        second_message = updated_note.history["content"][1]

        assert first_message["role"] == "user"
        assert first_message["content"] == "Hello there"
        assert first_message["id"] == 1

        assert second_message["role"] == "assistant"
        assert second_message["content"] == "Hello! How can I help you today?"
        assert second_message["id"] == 2
    
    def test_send_note_block_note_message(self, test_session, sample_notes):
        """Test sending note message (no AI response)."""
        # Add a note to database
        note = sample_notes[2]  # Empty note
        test_session.add(note)
        test_session.commit()
        test_session.refresh(note)
        
        message = NoteBlockCreate(block="This is my note about the lesson", is_note=True)
        result = send_note_block(test_session, note.id, message)

        # Notes should not trigger AI response
        assert result['status'] == 'ok'
        assert result['new_note_blocks'][0]['content'] == 'This is my note about the lesson'
        
        # Verify only user message was added to history
        updated_note = test_session.get(Note, note.id)
        assert len(updated_note.history["content"]) == 1
        only_message = updated_note.history["content"][0]
        assert only_message["role"] == "user"
        assert only_message["content"] == "This is my note about the lesson"
        assert only_message["is_note"] is True
        assert only_message["id"] == 1
    
    def test_send_note_block_note_not_found(self, test_session):
        """Test sending message to non-existent note."""
        message = NoteBlockCreate(block="Hello", is_note=False)
        
        with pytest.raises(HTTPException) as exc_info:
            send_note_block(test_session, 999, message)
        
        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Note not found"
    
    def test_send_note_block_initializes_empty_history(self, test_session):
        """Test that sending message to note with no history initializes it."""
        # Create note with empty history dict
        note = Note(name="No History Note", history={})
        test_session.add(note)
        test_session.commit()
        test_session.refresh(note)
        
        message = NoteBlockCreate(block="First message", is_note=True)
        send_note_block(test_session, note.id, message)
        
        # Verify history was initialized
        updated_note = test_session.get(Note, note.id)
        assert 'content' in updated_note.history
        assert len(updated_note.history['content']) == 1
        first_entry = updated_note.history['content'][0]
        assert first_entry["role"] == "user"
        assert first_entry["content"] == "First message"
        assert first_entry["id"] == 1
    
    @patch('backend.services.notes_service.client')
    def test_send_note_block_ai_error_handling(self, mock_client, test_session, sample_notes):
        """Test handling of AI client errors."""
        # Add a note to database
        note = sample_notes[0]
        test_session.add(note)
        test_session.commit()
        test_session.refresh(note)
        
        # Mock AI client to raise an error
        mock_client.chat.completions.create.side_effect = Exception("AI Service Error")
        
        message = NoteBlockCreate(block="Hello", is_note=False)
        
        # Service should handle AI errors gracefully
        with pytest.raises(Exception) as exc_info:
            send_note_block(test_session, note.id, message)
        
        assert "AI Service Error" in str(exc_info.value)
    
    @patch('backend.services.notes_service.client')
    def test_send_note_block_appends_to_existing_history(self, mock_client, test_session, sample_notes):
        """Test that new messages are appended to existing note history."""
        # Add a note with existing history
        note = sample_notes[0]  # Has 2 messages already
        test_session.add(note)
        test_session.commit()
        test_session.refresh(note)
        
        initial_length = len(note.history["content"])
        
        # Mock AI response
        class MockChunk:
            def __init__(self, content):
                self.choices = [type('obj', (object,), {
                    'delta': type('obj', (object,), {'content': content})()
                })()]
        
        mock_client.chat.completions.create.return_value = [MockChunk("Great question!")]
        
        message = NoteBlockCreate(block="Can you help me?", is_note=False)
        send_note_block(test_session, note.id, message)
        
        # Verify new messages were appended
        updated_note = test_session.get(Note, note.id)
        assert len(updated_note.history["content"]) == initial_length + 2  # user + assistant
        
        # Verify the new messages
        new_user_msg = updated_note.history["content"][-2]
        new_ai_msg = updated_note.history["content"][-1]
        
        assert new_user_msg["role"] == "user"
        assert new_user_msg["content"] == "Can you help me?"
        assert new_user_msg["id"] == 1
        assert new_ai_msg["role"] == "assistant"
        assert new_ai_msg["content"] == "Great question!"
        assert new_ai_msg["id"] == 2
    
    def test_create_multiple_notes(self, test_session):
        """Test creating multiple notes in the same session."""
        notes_data = [
            ("Note 1", {"content": []}),
            ("Note 2", {"content": [{
                "id": 0,
                "role": "user",
                "content": "Hello",
                "created_at": "2024-01-02T00:00:00",
                "updated_at": "2024-01-02T00:00:00",
                "is_note": False,
                "image_ids": [],
            }]}),
            ("Note 3", {"content": []})
        ]
        
        created_notes = []
        for name, history in notes_data:
            note = Note(name=name, history=history)
            result = create_note(test_session, note)
            created_notes.append(result)
        
        # Verify all notes were created
        assert len(created_notes) == 3
        
        # Verify they exist in database
        note_list = get_note_list(test_session)
        assert len(note_list) == 3
        
        note_names = [note.name for note in note_list]
        assert "Note 1" in note_names
        assert "Note 2" in note_names
        assert "Note 3" in note_names
    
    def test_note_history_json_serialization(self, test_session):
        """Test that note history with complex data is properly serialized."""
        complex_history = {
            "content": [
                {
                    "id": 0,
                    "role": "user", 
                    "content": "Hello",
                    "created_at": "2024-01-03T00:00:00",
                    "updated_at": "2024-01-03T00:00:00",
                    "is_note": False,
                    "image_ids": [],
                    "metadata": {"timestamp": "2023-01-01T00:00:00"}
                },
                {
                    "id": 1,
                    "role": "assistant",
                    "content": "Hi there!",
                    "created_at": "2024-01-03T00:05:00",
                    "updated_at": "2024-01-03T00:05:00",
                    "is_note": False,
                    "image_ids": [],
                    "metadata": {"model": "gpt-3.5-turbo"}
                }
            ],
            "settings": {
                "language": "en",
                "level": "intermediate"
            }
        }
        
        note = Note(name="Complex History Note", history=complex_history)
        result = create_note(test_session, note)
        
        # Verify complex data was saved and retrieved correctly
        saved_note = test_session.get(Note, result.id)
        assert saved_note.history == complex_history
        assert saved_note.history["settings"]["language"] == "en"
        assert len(saved_note.history["content"]) == 2