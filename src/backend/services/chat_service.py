import os
import uuid
import aiofiles
from pathlib import Path
from sqlmodel import Session, select, update, delete
from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse
from openai import OpenAI
from typing import List
import mimetypes

from backend.models.chat import Chat, ChatListResponse, Message, ChatImage, ChatImageResponse
from backend.constants import SYSTEM_PROMPT

# Initialize OpenAI client
client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
)

def create_chat(session: Session, chat: Chat) -> Chat:
    """Create a new chat session."""
    session.add(chat)
    session.commit()
    session.refresh(chat)
    return chat

def get_chat_list(session: Session, offset: int = 0, limit: int = 100) -> list[ChatListResponse]:
    """Get a list of chat sessions."""
    chats = session.exec(select(Chat).order_by(Chat.id.desc()).limit(limit).offset(offset)).all()
    chats = [ChatListResponse(id=chat.id, name=chat.name) for chat in chats]
    return chats

def get_chat(session: Session, id: int) -> Chat:
    """Get a specific chat session by ID."""
    chat = session.get(Chat, id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat

def delete_chat(session: Session, id: int) -> dict:
    """Delete a chat session by ID."""
    query = delete(Chat).where(Chat.id == id)
    session.exec(query)
    session.commit()
    return {'status': 'ok'}

def send_message(session: Session, id: int, message: Message) -> dict:
    """Send a message to a chat session and get response."""
    import re
    import base64
    
    # Retrieve the chat object
    chat = session.get(Chat, id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Ensure that history has a 'content' key which is a list
    history = chat.history
    if 'content' not in history or not isinstance(history['content'], list):
        history['content'] = []

    # Parse image references in the message
    processed_message = message.message
    image_contents = []
    
    # Find all image references in format @image:id
    image_refs = re.findall(r'@image:(\d+)', message.message)
    
    if image_refs:
        # Get referenced images
        for img_id in image_refs:
            try:
                image = session.exec(
                    select(ChatImage).where(ChatImage.id == int(img_id), ChatImage.chat_id == id)
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

    # Create message content for chat history and OpenAI
    if image_contents:
        # For OpenAI API with images
        user_content = [{"type": "text", "text": processed_message}] + image_contents
        # For chat history - keep original message with @image:id references for frontend
        history_content = message.message
    else:
        user_content = processed_message
        history_content = message.message

    # Append the user's message to history
    history['content'].append({
        "role": "user",
        "content": history_content,
    })

    # Update DB with user's message
    session.exec(
        update(Chat)
        .where(Chat.id == id)
        .values(history=history)
    )
    session.commit()

    assistant_response = ''
    
    if not message.is_note:
        # Prepare messages for OpenAI API
        api_messages = [
            {
                "role": "developer",
                "content": SYSTEM_PROMPT,
            }
        ]
        
        # Add chat history (text only for previous messages)
        for hist_msg in history['content'][:-1]:  # Exclude the current message
            api_messages.append(hist_msg)
        
        # Add current message with potential images
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

        # Append the assistant's message
        history['content'].append({
            "role": "assistant",
            "content": assistant_response,
        })

        # Update DB with assistant's response
        session.exec(
            update(Chat)
            .where(Chat.id == id)
            .values(history=history)
        )
        session.commit()

    return {
        'chat_bot_message': assistant_response
    }

# Image upload directory configuration
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/tmp/chat_images"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Allowed image types
ALLOWED_IMAGE_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/bmp"
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

async def upload_chat_image(session: Session, chat_id: int, file: UploadFile) -> ChatImageResponse:
    """Upload an image to a chat."""
    # Verify chat exists
    chat = session.get(Chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
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
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    # Create database record
    chat_image = ChatImage(
        chat_id=chat_id,
        filename=unique_filename,
        original_filename=file.filename,
        file_path=str(file_path),
        mime_type=file.content_type,
        file_size=len(content)
    )
    
    session.add(chat_image)
    session.commit()
    session.refresh(chat_image)
    
    return ChatImageResponse(
        id=chat_image.id,
        filename=chat_image.filename,
        original_filename=chat_image.original_filename,
        mime_type=chat_image.mime_type,
        file_size=chat_image.file_size,
        uploaded_at=chat_image.uploaded_at
    )

def get_chat_images(session: Session, chat_id: int) -> List[ChatImageResponse]:
    """Get all images for a chat."""
    # Verify chat exists
    chat = session.get(Chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    images = session.exec(
        select(ChatImage).where(ChatImage.chat_id == chat_id).order_by(ChatImage.uploaded_at.desc())
    ).all()
    
    return [
        ChatImageResponse(
            id=img.id,
            filename=img.filename,
            original_filename=img.original_filename,
            mime_type=img.mime_type,
            file_size=img.file_size,
            uploaded_at=img.uploaded_at
        )
        for img in images
    ]

def delete_chat_image(session: Session, chat_id: int, image_id: int) -> dict:
    """Delete an image from a chat."""
    # Verify chat exists
    chat = session.get(Chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Get image
    image = session.exec(
        select(ChatImage).where(ChatImage.id == image_id, ChatImage.chat_id == chat_id)
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

def get_chat_image_file(session: Session, chat_id: int, image_id: int) -> FileResponse:
    """Get the actual image file."""
    # Verify chat exists
    chat = session.get(Chat, chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    # Get image
    image = session.exec(
        select(ChatImage).where(ChatImage.id == image_id, ChatImage.chat_id == chat_id)
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