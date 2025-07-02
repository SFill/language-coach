# Import all services for easy access
from .chat_service import (
    create_chat, get_chat_list, get_chat, 
    delete_chat, send_message
)
from .translation_service import translate_text
from .dictionary_service import get_english_word_definition as get_english_word_definition
from .dict_spanish_service import get_spanish_word_definition
from .unified_dictionary_service import get_word_definition
from .sentence.sentence_service import search_for_sentences