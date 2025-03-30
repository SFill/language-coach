from enum import Enum
import logging
import os
import re
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import requests
from sqlmodel import SQLModel, Field, Session, create_engine, select, update, Column, JSON, delete
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
    is_note: bool = False


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
    chats = session.exec(select(Chat).order_by(Chat.id.desc()).limit(limit).offset(offset)).all()
    return chats


@app.get('/api/coach/chat/{id}')
def get_chat(session: SessionDep, id: int):
    chat = session.get(Chat, id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


@app.delete('/api/coach/chat/{id}')
def delete_chat(session: SessionDep, id: int):

    query = delete(Chat).where(Chat.id == id)
    session.exec(query)
    session.commit()
    return {'status': 'ok'}


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
    else:
        assistant_response = ''

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


# ---------------------------
# New Feature: Dictionary and Wordlist Endpoints
# Adjusted models: store definitions for words and manage word lists.
class Wordlist(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field()
    # list of words (strings)
    words: list[str] = Field(default_factory=list, sa_column=Column(JSON))


class Dictionary(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    word: str
    # Store the dictionary API response (definition data) as a dict
    word_meta: dict = Field(default_factory=dict, sa_column=Column(JSON))


# ---------------------------
# New Classes for Word Definitions
class EnglishDialect(str, Enum):
    us = 'us'
    uk = 'uk'


class WordDefinitionDetail(BaseModel):
    definition: str
    synonyms: list[str] = []
    antonyms: list[str] = []
    example: str | None = None


class WordMeaning(BaseModel):
    part_of_speech: str
    definitions: list[WordDefinitionDetail]
    synonyms: list[str] = []
    antonyms: list[str] = []


class EnglishWordDefinition(BaseModel):
    audio_link: str | None
    english_dialect: EnglishDialect
    meanings: list[WordMeaning]


# ---------------------------
# Dictionary API Client
class DictionaryApiClient:
    url = 'https://api.dictionaryapi.dev/api/v2/entries/en/{}'

    @staticmethod
    def define(word: str) -> list:
        response = requests.get(DictionaryApiClient.url.format(word))
        if response.status_code != 200:
            raise Exception(f"Error fetching definition for word: {word}")
        return response.json()


def parse_english_word_definition(api_data: list) -> EnglishWordDefinition:
    """
    Parse the API response (list) into an EnglishWordDefinition instance.
    """
    if not api_data:
        return EnglishWordDefinition(audio_link=None, english_dialect=EnglishDialect.us, meanings=[])

    entry = api_data[0]

    # Pick the first valid audio link and determine dialect
    audio_link = None
    dialect = EnglishDialect.us
    for phon in entry.get("phonetics", []):
        audio = phon.get("audio")
        if audio:
            audio_link = audio
            if "uk" in audio:
                dialect = EnglishDialect.uk
            else:
                dialect = EnglishDialect.us
            break

    meanings = []
    for meaning in entry.get("meanings", []):
        part_of_speech = meaning.get("partOfSpeech")
        synonyms = meaning.get("synonyms", [])
        antonyms = meaning.get("antonyms", [])
        definitions = []
        for d in meaning.get("definitions", []):
            definitions.append(WordDefinitionDetail(
                definition=d.get("definition"),
                synonyms=d.get("synonyms", []),
                antonyms=d.get("antonyms", []),
                example=d.get("example")
            ))
        meanings.append(WordMeaning(
            part_of_speech=part_of_speech,
            definitions=definitions,
            synonyms=synonyms,
            antonyms=antonyms
        ))

    return EnglishWordDefinition(
        audio_link=audio_link,
        english_dialect=dialect,
        meanings=meanings
    )


# Helper function: retrieve a word's definition from the DB or via API if not already stored.
def _get_word_definition(word: str, session: Session) -> EnglishWordDefinition:
    dictionary_entry = session.exec(select(Dictionary).where(Dictionary.word == word)).first()
    if dictionary_entry is None:
        try:
            api_data = DictionaryApiClient.define(word)
            english_def = parse_english_word_definition(api_data)
        except Exception as e:
            english_def = EnglishWordDefinition(audio_link=None, english_dialect=EnglishDialect.us, meanings=[])
        dictionary_entry = Dictionary(word=word, word_meta=english_def.dict())
        session.add(dictionary_entry)
        session.commit()
        session.refresh(dictionary_entry)
    else:
        english_def = EnglishWordDefinition(**dictionary_entry.word_meta)
    return english_def


# ---------------------------
# Pydantic models for Wordlist endpoints
class WordlistCreate(BaseModel):
    name: str
    words: list[str]


class WordlistUpdate(BaseModel):
    name: str | None = None
    words: list[str] | None = None


class WordDefinitionResponse(BaseModel):
    word: str
    definition: EnglishWordDefinition


class WordlistResponse(BaseModel):
    id: int
    name: str
    words: list[WordDefinitionResponse]


@app.get('/api/wordlist/', response_model=list[WordlistResponse])
def list_wordlists(session: SessionDep):
    wordlists = session.exec(select(Wordlist)).all()
    results = []
    for wl in wordlists:
        definitions = []
        for word in wl.words:
            eng_def = _get_word_definition(word, session)
            definitions.append(WordDefinitionResponse(word=word, definition=eng_def))
        results.append(WordlistResponse(id=wl.id, name=wl.name, words=definitions))
    return results


@app.post('/api/wordlist/', response_model=WordlistResponse)
def create_wordlist(wordlist: WordlistCreate, session: SessionDep):
    new_wordlist = Wordlist(name=wordlist.name, words=wordlist.words)
    session.add(new_wordlist)
    session.commit()
    session.refresh(new_wordlist)
    definitions = []
    for word in new_wordlist.words:
        eng_def = _get_word_definition(word, session)
        definitions.append(WordDefinitionResponse(word=word, definition=eng_def))
    return WordlistResponse(id=new_wordlist.id, name=new_wordlist.name, words=definitions)


@app.get('/api/wordlist/{pk}', response_model=WordlistResponse)
def get_wordlist(pk: int, session: SessionDep):
    wl = session.get(Wordlist, pk)
    if not wl:
        raise HTTPException(status_code=404, detail="Wordlist not found")
    definitions = []
    for word in wl.words:
        eng_def = _get_word_definition(word, session)
        definitions.append(WordDefinitionResponse(word=word, definition=eng_def))
    return WordlistResponse(id=wl.id, name=wl.name, words=definitions)


@app.put('/api/wordlist/{pk}', response_model=WordlistResponse)
def update_wordlist(pk: int, wordlist: WordlistUpdate, session: SessionDep):
    wl = session.get(Wordlist, pk)
    if not wl:
        raise HTTPException(status_code=404, detail="Wordlist not found")
    if wordlist.name is not None:
        wl.name = wordlist.name
    if wordlist.words is not None:
        wl.words = wordlist.words
    session.add(wl)
    session.commit()
    session.refresh(wl)
    definitions = []
    for word in wl.words:
        eng_def = _get_word_definition(word, session)
        definitions.append(WordDefinitionResponse(word=word, definition=eng_def))
    return WordlistResponse(id=wl.id, name=wl.name, words=definitions)


@app.delete('/api/wordlist/{pk}')
def delete_wordlist(pk: int, session: SessionDep):
    wl = session.get(Wordlist, pk)
    if not wl:
        raise HTTPException(status_code=404, detail="Wordlist not found")
    session.delete(wl)
    session.commit()
    return {"detail": "Wordlist deleted"}


@app.get('/api/words/{word}', response_model=EnglishWordDefinition)
def get_word_definition(word: str, session: SessionDep) -> EnglishWordDefinition:
    return _get_word_definition(word, session)


if not os.getenv('BACKEND_ENV', None) == 'dev':
    # Mount the static files (built assets are in /app/dist)
    app.mount("/", StaticFiles(directory="/app/dist", html=True), name="static")
