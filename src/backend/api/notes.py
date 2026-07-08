from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from typing import Annotated, List, Optional
from sqlmodel import Session

from backend.database import get_session
from backend.models.note import (
    Note,
    NoteCreate,
    NoteListResponse,
    NoteBlockCreate,
    NoteBlockUpdate,
    NoteImageResponse,
    QuestionCreate,
    AnalyzeResponse,
)
from backend.services.notes_service import (
    create_note, get_note_list, get_note,
    delete_note, send_note_block, update_note_block, delete_note_block,
    upload_note_image, get_note_images, delete_note_image, get_note_image_file,
)
from backend.services.question_service import QuestionService
from backend.services.assignment_service import AssignmentService

# Create router
router = APIRouter(prefix="/api/coach/notes", tags=["notes"])

# Type alias for session dependency
SessionDep = Annotated[Session, Depends(get_session)]


@router.post('/')
def create_note_endpoint(session: SessionDep, note_data: NoteCreate):
    """Create a new note session."""
    note = Note(
        name=note_data.name,
        metadata_=note_data.note_metadata,
        history=note_data.history,
    )
    return create_note(session, note)


@router.get('/', response_model=list[NoteListResponse])
def get_note_list_endpoint(
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=100)] = 100,
    block_type: Optional[str] = None,
):
    """Get a list of note sessions, optionally filtered by block_type."""
    return get_note_list(session, offset, limit, block_type)


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
    return QuestionService(session).process_question(id, question_data)


@router.post('/{id}/block/{note_block_id}/analyze', response_model=AnalyzeResponse)
def analyze_draft_endpoint(session: SessionDep, id: int, note_block_id: str):
    """Analyze a student draft block and return annotated segments."""
    service = AssignmentService(session)
    return service.analyze_draft(id, note_block_id)


@router.patch('/{id}/block/{note_block_id}')
def update_note_block_endpoint(
    session: SessionDep,
    id: int,
    note_block_id: str,
    payload: NoteBlockUpdate,
):
    """Upsert a note block: update if exists, create if not found (idempotent)."""
    return update_note_block(session, id, note_block_id, payload)


@router.delete('/{id}/block/{note_block_id}')
def delete_note_block_endpoint(session: SessionDep, id: int, note_block_id: str):
    """Delete a specific note block from a note."""
    return delete_note_block(session, id, note_block_id)


@router.post('/{id}/images', response_model=NoteImageResponse)
async def upload_note_image_endpoint(
    session: SessionDep,
    id: int,
    file: UploadFile = File(...),
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