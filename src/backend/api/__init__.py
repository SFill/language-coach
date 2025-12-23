# Import all routers to include them in the application
from .notes import router as notes_router
from .translation import router as translation_router
# Keep old import for backward compatibility during transition
from .notes import router as notes_router
from .dictionary import router as dictionary_router
from .wordlist import router as wordlist_router
from .sentence import router as sentence_router