import pytest
from unittest.mock import patch
from fastapi import HTTPException

from backend.services.chat_service import (
    create_chat, get_chat_list, get_chat, delete_chat, send_message
)
from backend.models.chat import Chat, ChatListResponse, ChatMessageCreate


class TestChatService:
    """Test the chat service with real database operations."""
    
    
    def test_create_chat_basic(self, test_session):
        """Test basic chat creation functionality."""
        chat = Chat(name="Test Chat", history={"content": []})
        
        result = create_chat(test_session, chat)
        
        # Verify chat was created and returned
        assert result is not None
        assert isinstance(result, Chat)
        assert result.name == "Test Chat"
        assert result.history == {"content": []}
        assert result.id is not None
        
        # Verify chat was saved to database
        saved_chat = test_session.get(Chat, result.id)
        assert saved_chat is not None
        assert saved_chat.name == "Test Chat"
    
    def test_create_chat_with_history(self, test_session):
        """Test creating chat with initial history."""
        initial_history = {
            "content": [
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi! How can I help?"}
            ]
        }
        chat = Chat(name="Chat with History", history=initial_history)
        
        result = create_chat(test_session, chat)
        
        assert result.history == initial_history
        assert len(result.history["content"]) == 2
        
        # Verify in database
        saved_chat = test_session.get(Chat, result.id)
        assert saved_chat.history == initial_history
    
    def test_get_chat_list_empty(self, test_session):
        """Test getting chat list when no chats exist."""
        result = get_chat_list(test_session)
        
        assert isinstance(result, list)
        assert len(result) == 0
    
    def test_get_chat_list_with_chats(self, test_session, sample_chats):
        """Test getting chat list with existing chats."""
        # Add sample chats to database
        for chat in sample_chats:
            test_session.add(chat)
        test_session.commit()
        
        result = get_chat_list(test_session)
        
        assert isinstance(result, list)
        assert len(result) == 3
        
        # Verify all items are ChatListResponse objects
        for item in result:
            assert isinstance(item, ChatListResponse)
            assert hasattr(item, 'id')
            assert hasattr(item, 'name')
        
        # Verify specific chats are present
        chat_names = [chat.name for chat in result]
        assert "English Practice" in chat_names
        assert "Spanish Learning" in chat_names
        assert "Empty Chat" in chat_names
    
    def test_get_chat_exists(self, test_session, sample_chats):
        """Test retrieving existing chat."""
        # Add a chat to database
        chat = sample_chats[0]
        test_session.add(chat)
        test_session.commit()
        test_session.refresh(chat)
        
        result = get_chat(test_session, chat.id)
        
        assert result is not None
        assert isinstance(result, Chat)
        assert result.id == chat.id
        assert result.name == "English Practice"
        assert len(result.history["content"]) == 2
    
    def test_get_chat_not_found(self, test_session):
        """Test retrieving non-existent chat."""
        with pytest.raises(HTTPException) as exc_info:
            get_chat(test_session, 999)
        
        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Chat not found"
    
    def test_delete_chat_exists(self, test_session, sample_chats):
        """Test deleting existing chat."""
        # Add a chat to database
        chat = sample_chats[0]
        test_session.add(chat)
        test_session.commit()
        test_session.refresh(chat)
        chat_id = chat.id
        
        result = delete_chat(test_session, chat_id)
        
        assert result == {'status': 'ok'}
        
        # Verify chat was deleted from database
        deleted_chat = test_session.get(Chat, chat_id)
        assert deleted_chat is None
    
    def test_delete_chat_not_found(self, test_session):
        """Test deleting non-existent chat - should still return ok."""
        result = delete_chat(test_session, 999)
        
        # Service returns ok even if chat doesn't exist
        assert result == {'status': 'ok'}
    
    @patch('backend.services.chat_service.client')
    def test_send_message_regular_message_success(self, mock_client, test_session, sample_chats):
        """Test sending regular message and getting AI response."""
        # Add a chat to database
        chat = sample_chats[2]  # Empty chat
        test_session.add(chat)
        test_session.commit()
        test_session.refresh(chat)
        
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
        
        message = ChatMessageCreate(message="Hello there", is_note=False)
        result = send_message(test_session, chat.id, message)

        # Verify response structure
        assert result['status'] == 'ok'
        assert len(result['new_messages']) == 2
        assert result['new_messages'][1]['content'] == "Hello! How can I help you today?"
        
        # Verify AI client was called
        mock_client.chat.completions.create.assert_called_once()
        call_args = mock_client.chat.completions.create.call_args
        assert call_args[1]['stream'] == True
        
        # Verify chat history was updated in database
        updated_chat = test_session.get(Chat, chat.id)
        assert len(updated_chat.history["content"]) == 2
        first_message = updated_chat.history["content"][0]
        second_message = updated_chat.history["content"][1]

        assert first_message["role"] == "user"
        assert first_message["content"] == "Hello there"
        assert first_message["id"] == 1

        assert second_message["role"] == "assistant"
        assert second_message["content"] == "Hello! How can I help you today?"
        assert second_message["id"] == 2
    
    def test_send_message_note_message(self, test_session, sample_chats):
        """Test sending note message (no AI response)."""
        # Add a chat to database
        chat = sample_chats[2]  # Empty chat
        test_session.add(chat)
        test_session.commit()
        test_session.refresh(chat)
        
        message = ChatMessageCreate(message="This is my note about the lesson", is_note=True)
        result = send_message(test_session, chat.id, message)

        # Notes should not trigger AI response
        assert result['status'] == 'ok'
        assert result['new_messages'][0]['content'] == 'This is my note about the lesson'
        
        # Verify only user message was added to history
        updated_chat = test_session.get(Chat, chat.id)
        assert len(updated_chat.history["content"]) == 1
        only_message = updated_chat.history["content"][0]
        assert only_message["role"] == "user"
        assert only_message["content"] == "This is my note about the lesson"
        assert only_message["is_note"] is True
        assert only_message["id"] == 1
    
    def test_send_message_chat_not_found(self, test_session):
        """Test sending message to non-existent chat."""
        message = ChatMessageCreate(message="Hello", is_note=False)
        
        with pytest.raises(HTTPException) as exc_info:
            send_message(test_session, 999, message)
        
        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == "Chat not found"
    
    def test_send_message_initializes_empty_history(self, test_session):
        """Test that sending message to chat with no history initializes it."""
        # Create chat with empty history dict
        chat = Chat(name="No History Chat", history={})
        test_session.add(chat)
        test_session.commit()
        test_session.refresh(chat)
        
        message = ChatMessageCreate(message="First message", is_note=True)
        send_message(test_session, chat.id, message)
        
        # Verify history was initialized
        updated_chat = test_session.get(Chat, chat.id)
        assert 'content' in updated_chat.history
        assert len(updated_chat.history['content']) == 1
        first_entry = updated_chat.history['content'][0]
        assert first_entry["role"] == "user"
        assert first_entry["content"] == "First message"
        assert first_entry["id"] == 1
    
    @patch('backend.services.chat_service.client')
    def test_send_message_ai_error_handling(self, mock_client, test_session, sample_chats):
        """Test handling of AI client errors."""
        # Add a chat to database
        chat = sample_chats[0]
        test_session.add(chat)
        test_session.commit()
        test_session.refresh(chat)
        
        # Mock AI client to raise an error
        mock_client.chat.completions.create.side_effect = Exception("AI Service Error")
        
        message = ChatMessageCreate(message="Hello", is_note=False)
        
        # Service should handle AI errors gracefully
        with pytest.raises(Exception) as exc_info:
            send_message(test_session, chat.id, message)
        
        assert "AI Service Error" in str(exc_info.value)
    
    @patch('backend.services.chat_service.client')
    def test_send_message_appends_to_existing_history(self, mock_client, test_session, sample_chats):
        """Test that new messages are appended to existing chat history."""
        # Add a chat with existing history
        chat = sample_chats[0]  # Has 2 messages already
        test_session.add(chat)
        test_session.commit()
        test_session.refresh(chat)
        
        initial_length = len(chat.history["content"])
        
        # Mock AI response
        class MockChunk:
            def __init__(self, content):
                self.choices = [type('obj', (object,), {
                    'delta': type('obj', (object,), {'content': content})()
                })()]
        
        mock_client.chat.completions.create.return_value = [MockChunk("Great question!")]
        
        message = ChatMessageCreate(message="Can you help me?", is_note=False)
        send_message(test_session, chat.id, message)
        
        # Verify new messages were appended
        updated_chat = test_session.get(Chat, chat.id)
        assert len(updated_chat.history["content"]) == initial_length + 2  # user + assistant
        
        # Verify the new messages
        new_user_msg = updated_chat.history["content"][-2]
        new_ai_msg = updated_chat.history["content"][-1]
        
        assert new_user_msg["role"] == "user"
        assert new_user_msg["content"] == "Can you help me?"
        assert new_user_msg["id"] == 1
        assert new_ai_msg["role"] == "assistant"
        assert new_ai_msg["content"] == "Great question!"
        assert new_ai_msg["id"] == 2
    
    def test_create_multiple_chats(self, test_session):
        """Test creating multiple chats in the same session."""
        chats_data = [
            ("Chat 1", {"content": []}),
            ("Chat 2", {"content": [{
                "id": 0,
                "role": "user",
                "content": "Hello",
                "created_at": "2024-01-02T00:00:00",
                "updated_at": "2024-01-02T00:00:00",
                "is_note": False,
                "image_ids": [],
            }]}),
            ("Chat 3", {"content": []})
        ]
        
        created_chats = []
        for name, history in chats_data:
            chat = Chat(name=name, history=history)
            result = create_chat(test_session, chat)
            created_chats.append(result)
        
        # Verify all chats were created
        assert len(created_chats) == 3
        
        # Verify they exist in database
        chat_list = get_chat_list(test_session)
        assert len(chat_list) == 3
        
        chat_names = [chat.name for chat in chat_list]
        assert "Chat 1" in chat_names
        assert "Chat 2" in chat_names
        assert "Chat 3" in chat_names
    
    def test_chat_history_json_serialization(self, test_session):
        """Test that chat history with complex data is properly serialized."""
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
        
        chat = Chat(name="Complex History Chat", history=complex_history)
        result = create_chat(test_session, chat)
        
        # Verify complex data was saved and retrieved correctly
        saved_chat = test_session.get(Chat, result.id)
        assert saved_chat.history == complex_history
        assert saved_chat.history["settings"]["language"] == "en"
        assert len(saved_chat.history["content"]) == 2
