import os
from sqlmodel import Session, select, update, delete
from fastapi import HTTPException
from openai import OpenAI

from ..models.chat import Chat, ChatListResponse, Message
from ..constants import SYSTEM_PROMPT

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
    # Retrieve the chat object
    chat = session.get(Chat, id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Ensure that history has a 'content' key which is a list
    history = chat.history
    if 'content' not in history or not isinstance(history['content'], list):
        history['content'] = []

    # Append the user's message
    history['content'].append({
        "role": "user",
        "content": message.message,
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
        # Call GPT or whichever model
        response_stream = client.chat.completions.create(
            messages=[
                {
                    "role": "developer",
                    "content": SYSTEM_PROMPT,
                }
            ] + chat.history['content'],
            model="gpt-4o-mini",  # example placeholder model name
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