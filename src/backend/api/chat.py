from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from typing import Annotated, List
from sqlmodel import Session

from backend.database import get_session
from backend.models.chat import Chat, ChatListResponse, Message, ChatImageResponse
from backend.services.chat_service import (
    create_chat, get_chat_list, get_chat,
    delete_chat, send_message, upload_chat_image,
    get_chat_images, delete_chat_image, get_chat_image_file
)

# Create router
router = APIRouter(prefix="/api/coach/chat", tags=["chat"])

# Type alias for session dependency
SessionDep = Annotated[Session, Depends(get_session)]


@router.post('/')
def create_chat_endpoint(session: SessionDep, chat: Chat):
    """Create a new chat session."""
    return create_chat(session, chat)


@router.get('/', response_model=list[ChatListResponse])
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


@router.post('/{id}/images', response_model=ChatImageResponse)
async def upload_chat_image_endpoint(
    session: SessionDep, 
    id: int, 
    file: UploadFile = File(...)
):
    """Upload an image to a chat."""
    return await upload_chat_image(session, id, file)


@router.get('/{id}/images', response_model=List[ChatImageResponse])
def get_chat_images_endpoint(session: SessionDep, id: int):
    """Get all images for a chat."""
    return get_chat_images(session, id)


@router.delete('/{id}/images/{image_id}')
def delete_chat_image_endpoint(session: SessionDep, id: int, image_id: int):
    """Delete an image from a chat."""
    return delete_chat_image(session, id, image_id)


@router.get('/{id}/images/{image_id}/file')
def get_chat_image_file_endpoint(session: SessionDep, id: int, image_id: int):
    """Get the actual image file."""
    return get_chat_image_file(session, id, image_id)
