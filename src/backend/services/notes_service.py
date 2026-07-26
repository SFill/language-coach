import os
import uuid
from datetime import datetime
from pathlib import Path
from sqlmodel import Session, select, update, delete
from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse
from typing import List

from backend.models.note import (
    Note,
    NoteListResponse,
    NoteBlock,
    NoteBlockCreate,
    NoteBlockUpdate,
    NoteImage,
    NoteImageResponse,
)

def create_note(session: Session, note: Note) -> Note:
    """Create a new note session."""
    session.add(note)
    session.commit()
    session.refresh(note)
    return note

def get_note_list(session: Session, offset: int = 0, limit: int = 100, block_type: str = None) -> list[NoteListResponse]:
    """Get a list of note sessions, optionally filtered by block_type presence."""
    query = select(Note).order_by(Note.id.desc()).limit(limit).offset(offset)
    notes = session.exec(query).all()

    result = [
        NoteListResponse(
            id=note.id,
            name=note.name,
            note_metadata=note.metadata_,
            note_blocks=[NoteBlock.model_validate(msg) for msg in (note.history or {}).get('content', [])],
        )
        for note in notes
    ]

    # Filter by block_type if specified
    if block_type:
        result = [n for n in result if any(b.block_type == block_type for b in n.note_blocks)]

    return result

def get_note(session: Session, id: int) -> Note:
    """Get a specific note session by ID."""
    note = session.get(Note, id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note

def delete_note(session: Session, id: int) -> dict:
    """Delete a note session by ID, including associated images."""
    # Delete associated NoteImage rows (and their files) first
    images = session.exec(
        select(NoteImage).where(NoteImage.note_id == id)
    ).all()
    for image in images:
        try:
            os.remove(image.file_path)
        except OSError:
            pass
        session.delete(image)

    query = delete(Note).where(Note.id == id)
    session.exec(query)
    session.commit()
    return {'status': 'ok'}

def _ensure_history_content(history: dict) -> List[dict]:
    """Return note history content ensuring list structure."""
    if not(content:= history.get('content')):
        content = []
        history['content'] = content    
    if not isinstance(content, list):
        raise HTTPException(status_code=400, detail="Note history is corrupted")
    return content

def send_note_block(session: Session, id: int, note_block: NoteBlockCreate) -> dict:
    """Append a user note block to the note history. No AI reply."""
    note = session.get(Note, id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    history = note.history or {}
    content = _ensure_history_content(history)

    timestamp = datetime.utcnow()
    user_note_block = NoteBlock(
        id=note_block.id or str(uuid.uuid4()),
        role="user",
        content=note_block.block,
        created_at=timestamp,
        updated_at=timestamp,
        block_type=note_block.block_type,
        metadata_=note_block.metadata_,
        assignment_ref=note_block.assignment_ref,
        question_title=note_block.question_title,
        image_ids=note_block.image_ids,
    )

    content.append(user_note_block.model_dump(mode="json"))

    session.exec(
        update(Note)
        .where(Note.id == id)
        .values(history=history)
    )
    session.commit()

    return {
        'status': 'ok',
        'new_note_blocks': [user_note_block.model_dump(mode='json')],
    }

def get_first(iterable, value=None, key=None, default=None):
    match value is None, callable(key):
        case (True, True):
            gen = (elem for elem in iterable if key(elem))
        case (False, True):
            gen = (elem for elem in iterable if key(elem) == value)
        case (True, False):
            gen = (elem for elem in iterable if elem)
        case (False, False):
            gen = (elem for elem in iterable if elem == value)

    return next(gen, default)


def update_note_block(
    session: Session,
    note_id: int,
    note_block_id: str,
    payload: NoteBlockUpdate,
) -> dict:
    """Upsert a note block: update if exists, create if not found (idempotent)."""
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    history = note.history or {}
    content = _ensure_history_content(history)

    target_note_block = get_first(content, key=lambda block: block.get('id') == note_block_id)

    now = datetime.utcnow().isoformat()

    if target_note_block is None:
        # Block doesn't exist yet — create it (idempotent upsert)
        if payload.block is None:
            raise HTTPException(status_code=400, detail="Cannot create block without content")

        new_block = NoteBlock(
            id=note_block_id,
            role=payload.role or "user",
            content=payload.block,
            created_at=now,
            updated_at=now,
            block_type=payload.block_type,
            metadata_=payload.metadata_,
            assignment_ref=payload.assignment_ref,
        )
        content.append(new_block.model_dump(mode="json"))
    else:
        # Block exists — update it. image_ids is a stored field, left untouched
        # here (NoteBlockUpdate doesn't carry images).
        if payload.block is not None:
            target_note_block['content'] = payload.block
            target_note_block['updated_at'] = now

        if payload.role is not None:
            target_note_block['role'] = payload.role
        if payload.block_type is not None:
            target_note_block['block_type'] = payload.block_type
        if payload.metadata_ is not None:
            target_note_block['metadata_'] = payload.metadata_
        if payload.assignment_ref is not None:
            target_note_block['assignment_ref'] = payload.assignment_ref

    history['content'] = content
    session.exec(
        update(Note)
        .where(Note.id == note_id)
        .values(history=history)
    )
    session.commit()

    return {'status': 'ok'}


def delete_note_block(session: Session, note_id: int, note_block_id: str) -> dict:
    """Remove a note block from note history."""
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    history = note.history or {}
    content = _ensure_history_content(history)
    content = list(filter(lambda block: block.get('id') != note_block_id, content))
    history['content'] = content
    session.exec(
        update(Note)
        .where(Note.id == note_id)
        .values(history=history)
    )
    session.commit()

    return {'status': 'ok'}

# Image upload directory configuration
from backend.settings import get_settings

UPLOAD_DIR = get_settings().upload_dir
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Allowed image types
ALLOWED_IMAGE_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/bmp"
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

async def upload_note_image(session: Session, note_id: int, file: UploadFile) -> NoteImageResponse:
    """Upload an image to a note."""
    # Verify note exists
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Validate file type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES)}"
        )
    
    # Read file content and validate size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, 
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    # Generate unique filename
    file_extension = Path(file.filename).suffix.lower()
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = UPLOAD_DIR / unique_filename
    
    # Save file
    with open(file_path, 'wb') as f:
        f.write(content)
    
    # Create database record
    note_image = NoteImage(
        note_id=note_id,
        filename=unique_filename,
        original_filename=file.filename,
        file_path=str(file_path),
        mime_type=file.content_type,
        file_size=len(content)
    )
    
    session.add(note_image)
    session.commit()
    session.refresh(note_image)
    
    return NoteImageResponse(
        id=note_image.id,
        filename=note_image.filename,
        original_filename=note_image.original_filename,
        mime_type=note_image.mime_type,
        file_size=note_image.file_size,
        uploaded_at=note_image.uploaded_at
    )

def get_note_images(session: Session, note_id: int) -> List[NoteImageResponse]:
    """Get all images for a note."""
    # Verify note exists
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    images = session.exec(
        select(NoteImage).where(NoteImage.note_id == note_id).order_by(NoteImage.uploaded_at.desc())
    ).all()
    
    return [
        NoteImageResponse(
            id=img.id,
            filename=img.filename,
            original_filename=img.original_filename,
            mime_type=img.mime_type,
            file_size=img.file_size,
            uploaded_at=img.uploaded_at
        )
        for img in images
    ]

def delete_note_image(session: Session, note_id: int, image_id: int) -> dict:
    """Delete an image from a note."""
    # Verify note exists
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Get image
    image = session.exec(
        select(NoteImage).where(NoteImage.id == image_id, NoteImage.note_id == note_id)
    ).first()
    
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Delete file from filesystem
    try:
        os.remove(image.file_path)
    except OSError:
        pass  # File might already be deleted
    
    # Delete from database
    session.delete(image)
    session.commit()
    
    return {"status": "ok"}

def get_note_image_file(session: Session, note_id: int, image_id: int) -> FileResponse:
    """Get the actual image file."""
    # Verify note exists
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Get image
    image = session.exec(
        select(NoteImage).where(NoteImage.id == image_id, NoteImage.note_id == note_id)
    ).first()
    
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Check if file exists
    if not os.path.exists(image.file_path):
        raise HTTPException(status_code=404, detail="Image file not found")
    
    return FileResponse(
        path=image.file_path,
        media_type=image.mime_type,
        filename=image.original_filename
    )
