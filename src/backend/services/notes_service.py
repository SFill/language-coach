import os
import uuid
from datetime import datetime
from pathlib import Path
from sqlmodel import Session, select, update, delete
from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse
from openai import OpenAI
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
from backend.constants import SYSTEM_PROMPT

# Initialize OpenAI client
client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
)

def create_note(session: Session, note: Note) -> Note:
    """Create a new note session."""
    session.add(note)
    session.commit()
    session.refresh(note)
    return note

def get_note_list(session: Session, offset: int = 0, limit: int = 100) -> list[NoteListResponse]:
    """Get a list of note sessions."""
    notes = session.exec(select(Note).order_by(Note.id.desc()).limit(limit).offset(offset)).all()
    notes = [NoteListResponse(id=note.id, name=note.name) for note in notes]
    return notes

def get_note(session: Session, id: int) -> Note:
    """Get a specific note session by ID."""
    note = session.get(Note, id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note

def delete_note(session: Session, id: int) -> dict:
    """Delete a note session by ID."""
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
    """Send a note block to a note session and get response."""
    import re
    import base64
    
    # Retrieve the note object
    note = session.get(Note, id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    # Ensure that history has a 'content' key which is a list
    history = note.history or {}
    content = _ensure_history_content(history)

    # Parse image references in the note block
    processed_message = note_block.block
    image_contents = []
    
    # Find all image references in format @image:id
    image_refs = re.findall(r'@image:(\d+)', note_block.block)
    
    if image_refs:
        # Get referenced images
        for img_id in image_refs:
            try:
                image = session.exec(
                    select(NoteImage).where(NoteImage.id == int(img_id), NoteImage.note_id == id)
                ).first()
                
                if image and os.path.exists(image.file_path):
                    # Read and encode image
                    with open(image.file_path, 'rb') as f:
                        image_data = base64.b64encode(f.read()).decode()
                    
                    image_contents.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{image.mime_type};base64,{image_data}"
                        }
                    })
                    
                    # Replace reference with description in text
                    processed_message = processed_message.replace(
                        f"@image:{img_id}", 
                        f"[Image: {image.original_filename}]"
                    )
            except (ValueError, TypeError):
                continue

    # Create note block content for note history and OpenAI
    if image_contents:
        # For OpenAI API with images
        user_content = [{"type": "text", "text": processed_message}] + image_contents
        # For note history - keep original note block with @image:id references for frontend
        history_content = note_block.block
    else:
        user_content = processed_message
        history_content = note_block.block

    timestamp = datetime.utcnow()
    user_note_block = NoteBlock(
        id=note.get_new_note_block_id(),
        role="user",
        content=history_content,
        created_at=timestamp,
        updated_at=timestamp,
        is_note=note_block.is_note,
        image_ids=note_block.image_ids,
    )

    # Append the user's note block to history
    content.append(user_note_block.model_dump(mode="json"))

    # Update DB with user's note block
    session.exec(
        update(Note)
        .where(Note.id == id)
        .values(history=history)
    )
    session.commit()

    assistant_response = ''
    assistant_note_block = None
    if not note_block.is_note:
        # Prepare messages for OpenAI API
        api_messages = [
            {
                "role": "developer",
                "content": SYSTEM_PROMPT,
            }
        ]
        
        # Add note history (text only for previous note blocks)
        for hist_msg in content[:-1]:  # Exclude the current note block
            role = hist_msg.get("role")
            msg_content = hist_msg.get("content")
            api_messages.append({
                "role": role,
                "content": msg_content,
            })
        
        # Add current note block with potential images
        api_messages.append({
            "role": "user",
            "content": user_content
        })

        # Call GPT with support for images
        response_stream = client.chat.completions.create(
            messages=api_messages,
            model="gpt-4o-mini",  # This model supports images
            stream=True,
        )

        # Collect assistant's response
        for chunk in response_stream:
            delta = chunk.choices[0].delta.content
            if delta:
                assistant_response += delta

        if assistant_response:
            assistant_timestamp = datetime.utcnow()
            assistant_note_block = NoteBlock(
                id=note.get_new_note_block_id(),
                role="assistant",
                content=assistant_response,
                created_at=assistant_timestamp,
                updated_at=assistant_timestamp,
            )

            # Append the assistant's note block
            content.append(assistant_note_block.model_dump(mode="json"))

        # Update DB with assistant's response
        session.exec(
            update(Note)
            .where(Note.id == id)
            .values(history=history)
        )
        session.commit()

    new_note_blocks = [user_note_block.model_dump(mode="json")]
    if assistant_note_block is not None:
        new_note_blocks.append(assistant_note_block.model_dump(mode="json"))
    return {
        'status': 'ok',
        'new_note_blocks': new_note_blocks
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
    note_block_id: int,
    payload: NoteBlockUpdate,
) -> dict:
    """Update an existing note block."""
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    history = note.history or {}
    content = _ensure_history_content(history)

    target_note_block = get_first(content, key=lambda block: NoteBlock.model_validate(block).id == note_block_id)
    if target_note_block is None:
        raise HTTPException(status_code=404, detail="Note block not found")

    updated = False
    now = datetime.utcnow().isoformat()

    if payload.block is not None:
        target_note_block['content'] = payload.block
        updated = True

    if updated:
        target_note_block['updated_at'] = now

        history['content'] = content
        session.exec(
            update(Note)
            .where(Note.id == note_id)
            .values(history=history)
        )
        session.commit()

    return {'status': 'ok'}


def delete_note_block(session: Session, note_id: int, note_block_id: int) -> dict:
    """Remove a note block from note history."""
    note = session.get(Note, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    history = note.history or {}
    content = _ensure_history_content(history)
    content = list(filter(lambda block: NoteBlock.model_validate(block).id != note_block_id, content))
    history['content'] = content
    session.exec(
        update(Note)
        .where(Note.id == note_id)
        .values(history=history)
    )
    session.commit()

    return {'status': 'ok'}

# Image upload directory configuration
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/tmp/note_images"))
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
