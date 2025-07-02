# Import all routers to include them in the application
from .chat import router as chat_router
from .translation import router as translation_router
from .dictionary import router as dictionary_router
from .wordlist import router as wordlist_router
from .sentence import router as sentence_router