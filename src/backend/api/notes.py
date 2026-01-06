from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from typing import Annotated, List
from sqlmodel import Session

from backend.database import get_session
from backend.models.note import (
    Note,
    NoteListResponse,
    NoteBlockCreate,
    NoteBlockUpdate,
    NoteImageResponse,
    QuestionCreate,
)
from backend.services.notes_service import (
    create_note, get_note_list, get_note,
    delete_note, send_note_block, update_note_block, delete_note_block,
    upload_note_image, get_note_images, delete_note_image, get_note_image_file,
    send_question
)

# Create router
router = APIRouter(prefix="/api/coach/notes", tags=["notes"])

# Type alias for session dependency
SessionDep = Annotated[Session, Depends(get_session)]


@router.post('/')
def create_note_endpoint(session: SessionDep, note: Note):
    """Create a new note session."""
    return create_note(session, note)


@router.get('/', response_model=list[NoteListResponse])
def get_note_list_endpoint(
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=100)] = 100,
):
    """Get a list of note sessions."""
    return get_note_list(session, offset, limit)


@router.get('/{id}')
def get_note_endpoint(session: SessionDep, id: int):
    """Get a specific note by ID."""
    return get_note(session, id)


@router.delete('/{id}')
def delete_note_endpoint(session: SessionDep, id: int):
    """Delete a note by ID."""
    return delete_note(session, id)


@router.post('/{id}/block')
def send_note_block_endpoint(session: SessionDep, id: int, note_block: NoteBlockCreate):
    """Send a note block to a note and get a response."""
    return send_note_block(session, id, note_block)


@router.post('/{id}/question')
def send_question_endpoint(session: SessionDep, id: int, question_data: QuestionCreate):
    """Send a question about a note block and get a structured Q&A response."""
    return send_question(session, id, question_data)


@router.patch('/{id}/block/{note_block_id}')
def update_note_block_endpoint(
    session: SessionDep,
    id: int,
    note_block_id: int,
    payload: NoteBlockUpdate,
):
    """Update an existing note block within a note."""
    return update_note_block(session, id, note_block_id, payload)


@router.delete('/{id}/block/{note_block_id}')
def delete_note_block_endpoint(session: SessionDep, id: int, note_block_id: int):
    """Delete a specific note block from a note."""
    return delete_note_block(session, id, note_block_id)


@router.post('/{id}/images', response_model=NoteImageResponse)
async def upload_note_image_endpoint(
    session: SessionDep, 
    id: int, 
    file: UploadFile = File(...)
):
    """Upload an image to a note."""
    return await upload_note_image(session, id, file)


@router.get('/{id}/images', response_model=List[NoteImageResponse])
def get_note_images_endpoint(session: SessionDep, id: int):
    """Get all images for a note."""
    return get_note_images(session, id)


@router.delete('/{id}/images/{image_id}')
def delete_note_image_endpoint(session: SessionDep, id: int, image_id: int):
    """Delete an image from a note."""
    return delete_note_image(session, id, image_id)


@router.get('/{id}/images/{image_id}/file')
def get_note_image_file_endpoint(session: SessionDep, id: int, image_id: int):
    """Get the actual image file."""
    return get_note_image_file(session, id, image_id)
