from fastapi import APIRouter, Depends, Query
from typing import Annotated
from sqlmodel import Session

from ..database import get_session
from ..models.chat import Chat, Message
from ..services.chat_service import (
    create_chat, get_chat_list, get_chat,
    delete_chat, send_message
)

# Create router
router = APIRouter(prefix="/api/coach/chat", tags=["chat"])

# Type alias for session dependency
SessionDep = Annotated[Session, Depends(get_session)]


@router.post('/')
def create_chat_endpoint(session: SessionDep, chat: Chat):
    """Create a new chat session."""
    return create_chat(session, chat)


@router.get('/')
def get_chat_list_endpoint(
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=100)] = 100,
):
    """Get a list of chat sessions."""
    return get_chat_list(session, offset, limit)


@router.get('/{id}')
def get_chat_endpoint(session: SessionDep, id: int):
    """Get a specific chat by ID."""
    return get_chat(session, id)


@router.delete('/{id}')
def delete_chat_endpoint(session: SessionDep, id: int):
    """Delete a chat by ID."""
    return delete_chat(session, id)


@router.post('/{id}/message')
def send_message_endpoint(session: SessionDep, id: int, message: Message):
    """Send a message to a chat and get a response."""
    return send_message(session, id, message)