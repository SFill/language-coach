from openai import OpenAI
import os
from fastapi import FastAPI


from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from sqlmodel import Column, Field, JSON,  Session, SQLModel, create_engine, select, update
from pydantic import BaseModel


class Chat(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    history: dict = Field(default_factory=dict, sa_column=Column(JSON))


class Message(BaseModel):
    message: str


sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]


app = FastAPI()


client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),  # This is the default and can be omitted
)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


@app.post('/api/coach/chat')
def create_chat(session: SessionDep, chat: Chat):
    session.add(chat)
    session.commit()
    session.refresh(chat)
    return chat


@app.get('/api/coach/chat/')
def get_chat_list(session: SessionDep,
                  offset: int = 0,
                  limit: Annotated[int, Query(le=100)] = 100,):
    chats = session.exec(select(Chat).limit(limit).offset(offset)).all()

    return chats


@app.get('/api/coach/chat/{id}')
def get_chat(session: SessionDep, id: int):
    chat = session.get(Chat, id)
    if not chat:
        raise HTTPException(status_code=404, detail="Hero not found")
    return chat


@app.post('/api/coach/chat/{id}/message')
def send_message(session: SessionDep, id: int, message: Message):
    # Retrieve the chat object
    chat = session.get(Chat, id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Ensure that history has a 'content' key which is a list
    history = chat.history 
    if 'content' not in history or not isinstance(history['content'], list):
        chat.history['content'] = []

    # Append the user's message as an object
    history['content'].append({
        "role": "user",
        "content": message.message,
    })

    # Save the updated chat history (you can either commit here or update later)
    session.exec(
        update(Chat)
        .where(Chat.id == id)
        .values(history=history)
    )
    session.commit()

    # Use the list of message objects directly in the API call.
    # This lets you specify different roles (e.g., "user", "assistant", "system")
    response_stream = client.chat.completions.create(
        messages=chat.history['content'],
        model="gpt-4o-mini",
        stream=True,
    )

    # Collect the assistant's response from the stream
    assistant_response = ''
    for chunk in response_stream:
        # Accumulate the text from each streamed chunk.
        delta = chunk.choices[0].delta.content
        if delta:
            assistant_response += delta

    # Append the assistant's message as an object in the chat history
    history['content'].append({
        "role": "assistant",
        "content": assistant_response,
    })

    # Update the database with the new history.
    session.exec(
        update(Chat)
        .where(Chat.id == id)
        .values(history=history)
    )
    session.commit()
    return {
        'chat_bot_message': assistant_response
    }
