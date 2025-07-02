import logging.config
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import create_db_and_tables
from .api.chat import router as chat_router
from .api.translation import router as translation_router
from .api.dictionary import router as dictionary_router
from .api.wordlist import router as wordlist_router
from .api import sentence_router

# Create FastAPI application
app = FastAPI()

# --- CORS MIDDLEWARE SETUP ---
origins = ["*"]  # or specific origins if you want to restrict access
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# -----------------------------

# Include routers
app.include_router(chat_router)
app.include_router(translation_router)
app.include_router(dictionary_router)
app.include_router(wordlist_router)
app.include_router(sentence_router)


@app.on_event("startup")
def on_startup():
    """Initialize database on application startup."""
    create_db_and_tables()


# Mount static files in production mode
if not os.getenv('BACKEND_ENV', None) == 'dev':
    # Mount the static files (built assets are in /app/dist)
    app.mount("/", StaticFiles(directory="/app/dist", html=True), name="static")

import logging

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] [%(levelname)-8s] %(name)s: %(message)s",)