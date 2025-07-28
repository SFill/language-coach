import logging.config
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.services.sentence.sentence_service import get_sentence_retriever

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
    sentence_retriever = get_sentence_retriever()
    sentence_retriever.load_existing_indexes()


@app.on_event("shutdown")
def shutdown_event():
    sentence_retriever = get_sentence_retriever()
    sentence_retriever.save_indexes()


# Mount static files in production mode
if not os.getenv('BACKEND_ENV', None) == 'dev':
    from fastapi import Request
    from fastapi.responses import FileResponse
    
    # Mount static assets first (CSS, JS, images, etc.)
    app.mount("/assets", StaticFiles(directory="/app/dist/assets"), name="assets")
    
    # Catch-all route for SPA - serve index.html for non-API routes
    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        # Serve API routes normally (they're handled by routers above)
        # This catch-all only handles unmatched routes
        if full_path.startswith("api/"):
            # This shouldn't happen as API routes are defined above
            return {"error": "API route not found"}
        
        # For all other routes, serve the SPA index.html
        return FileResponse("/app/dist/index.html")

import logging

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] [%(levelname)-8s] %(name)s: %(message)s",)