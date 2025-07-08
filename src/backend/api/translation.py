from fastapi import APIRouter
from backend.models.wordlist import TranslateTextRequest
from backend.services.translation_service import translate_text

# Create router
router = APIRouter(prefix="/api", tags=["translation"])


@router.post('/translate')
def translate_text_endpoint(request: TranslateTextRequest):
    """Translate text from one language to another."""
    return translate_text(request)