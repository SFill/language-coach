import logging
import os
import re
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import requests
from sqlmodel import SQLModel, Field, Session, create_engine, select, update, Column, JSON
from pydantic import BaseModel
from typing import Annotated
from openai import OpenAI
from .constants import SYSTEM_PROMPT


class Chat(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    history: dict = Field(default_factory=dict, sa_column=Column(JSON))


class Message(BaseModel):
    message: str


# CREATE TABLE IF NOT EXISTS reverse_index (
#     word TEXT PRIMARY KEY,
#     sentence_ids JSON
# )

class ReverseIndex(SQLModel, table=True):

    __tablename__ = 'reverse_index'

    word: str = Field(primary_key=True)
    sentence_ids: list = Field(default_factory=list, sa_column=Column(JSON))

# CREATE TABLE IF NOT EXISTS sentences (
#     id INTEGER PRIMARY KEY,
#     sentence TEXT,
#     meta JSON
# )


class Sentence(SQLModel, table=True):

    __tablename__ = 'sentences'

    id: int = Field(primary_key=True)
    sentence: str
    meta: list[dict] = Field(default_factory=list, sa_column=Column(JSON))


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


# --- CORS MIDDLEWARE SETUP ---
origins = ["*"]  # or ["*"] if you just want to allow everything
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# -----------------------------

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
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
def get_chat_list(
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=100)] = 100,
):
    chats = session.exec(select(Chat).limit(limit).offset(offset)).all()
    return chats


@app.get('/api/coach/chat/{id}')
def get_chat(session: SessionDep, id: int):
    chat = session.get(Chat, id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
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
    assistant_response = ''
    for chunk in response_stream:
        delta = chunk.choices[0].delta.content
        if delta:
            assistant_response += delta

    # assistant_response = 'Hmm, you message is: \n' + message.message
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


@app.get('/api/coach/index/words/{word}')
def search_for_sentences(session: SessionDep, word: str):
    # Retrieve the sentences object
    reverse_index = session.exec(
        select(ReverseIndex).where(ReverseIndex.word == word)
    ).all()
    if not reverse_index:
        raise HTTPException(status_code=404, detail="word not found")

    sentence_ids = reverse_index[0].sentence_ids

    sentences = session.exec(
        select(Sentence).where(Sentence.id.in_(sentence_ids)).limit(1)
    ).all()

    return sentences


class GoogleTranslateHelper:

    FILE_WITH_TOKEN_URL = 'https://translate.googleapis.com/_/translate_http/_/js/k=translate_http.tr.en_US.YusFYy3P_ro.O/am=AAg/d=1/exm=el_conf/ed=1/rs=AN8SPfq1Hb8iJRleQqQc8zhdzXmF9E56eQ/m=el_main'

    TOKEN_REGEX = r"['\"]x-goog-api-key['\"]\s*:\s*['\"](\w{39})['\"]"

    API_URL = 'https://translate-pa.googleapis.com/v1/translateHtml'

    def _get_token(self):
        response = requests.get(self.FILE_WITH_TOKEN_URL)

        match = re.search(self.TOKEN_REGEX, str(response.content), re.IGNORECASE)
        if match:
            api_key = match.group(1)
            logging.info('got API key from google')
        else:
            raise ValueError('No Api key in file')

        return api_key

    def translate(self, message, target, source='auto'):
        url = "https://translate-pa.googleapis.com/v1/translateHtml"
        headers = {
            "Content-Type": "application/json+protobuf",
            "X-Goog-API-Key": self._get_token(),
        }
        # [[["Hello, how are you?"],"en","ru"],"wt_lib"]
        data = [[[message], source, target], "wt_lib"]

        response = requests.post(url, headers=headers, json=data)
        # [['Привет, как дела?']]
        return response.json()[0][0]


class TranslateTextRequest(BaseModel):
    text: str
    target: str


@app.post('/api/translate')
def translate_text(request: TranslateTextRequest):
    helper = GoogleTranslateHelper()
    return {
        'text': helper.translate(request.text, request.target)
    }


# Mount the static files (assuming your built assets are in /app/dist)
app.mount("/", StaticFiles(directory="/app/dist", html=True), name="static")
