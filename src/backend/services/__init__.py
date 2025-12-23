# Import all services for easy access
from .notes_service import (
    create_note,
    get_note_list,
    get_note,
    delete_note,
    send_note_block,
    update_note_block,
    delete_note_block,
)
from .translation_service import translate_text
from .dictionary_service import get_english_word_definition as get_english_word_definition
from .dict_spanish_service import get_spanish_word_definition
from .unified_dictionary_service import get_word_definition
from .sentence.sentence_service import search_for_sentences
