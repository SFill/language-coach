import os
import logging
from typing import Optional, Dict, Any
from fastapi import HTTPException
from openai import OpenAI
from sqlmodel import Session

from .sentence.sentence_service import get_sentence_retriever, search_for_sentences
from .translation_service import GoogleTranslateHelper
from .text_processor import TextProcessor, DatabaseSaver

# Configure logging
logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
)

def get_phrase_with_example_and_translation(
    phrase: str,
    language: str = "es",
    target_language: str = "en",
    proficiency: str = "intermediate",
    session: Optional[Session] = None,
    use_gpt_translation: bool = False
) -> Dict[str, str]:
    """
    Get phrase translation and example sentence with translation.
    Treats everything as phrases (words are just single-word phrases).
    
    Args:
        phrase: The phrase to process
        language: Source language (default: "es" for Spanish)
        target_language: Target language for translation (default: "en" for English)
        proficiency: Proficiency level for sentence complexity
        session: Database session for searching existing sentences
        use_gpt_translation: Whether to use GPT for translation instead of Google Translate
        
    Returns:
        Dictionary with word, word_translation, example_phrase, example_phrase_translation
    """
    
    # Get example sentence first
    example_sentence = None
    translations = None
    
    # Try to find existing sentences in database
    if session:
        try:
            existing_sentences = search_for_sentences(
                word=phrase,
                language=language,
                top_n=1,
                proficiency=proficiency
            )
            
            if existing_sentences:
                example_sentence = existing_sentences[0]["sentence"]
        except Exception:
            logger.exception(f"Failed to search existing sentences:")
    
    # If no existing sentence found, generate one with ChatGPT
    if not example_sentence:
        try:
            generated = generate_example_sentence_with_gpt(
                phrase=phrase,
                language=language,
                target_language=target_language,
                proficiency=proficiency
            )
            example_sentence = generated["example_phrase"]
            
            # Use translations from ChatGPT if available
            if generated.get("phrase_translation") and generated.get("example_translation"):
                translations = {
                    "phrase_translation": generated["phrase_translation"],
                    "example_translation": generated["example_translation"]
                }

            
            # Save the generated sentence to database if session is provided
            if session:
                try:
                    text_processor = TextProcessor()
                    db_saver = DatabaseSaver(session)
                    
                    # Process the generated sentence for tagging
                    processed_sentence = text_processor.process_sentence(example_sentence, language)
                    
                    # Save to database with ChatGpt source
                    text_entry, phrase_entry = db_saver.save_sentence(
                        sentence=example_sentence,
                        language=language,
                        source="ChatGpt",
                        title=f"Generated Examples - {language.upper()}",
                        category="generated",
                        words_data=processed_sentence["words"]
                    )
                    get_sentence_retriever(proficiency).add_phrase_to_index(text_entry, phrase_entry, language)
                    
                    
                except Exception:
                    logger.exception(f"Failed to save generated sentence to database:")
                    # Don't fail the main request if saving fails
                    
        except Exception as e:
            logger.exception(f"Failed to generate example sentence:")
            # Use simple fallback
            example_sentence = phrase
    
    # Translate both phrase and example sentence if we don't have translations yet
    if not translations:
        try:
            if use_gpt_translation:
                translations = translate_phrase_and_example_with_gpt(
                    phrase, example_sentence, target_language
                )
            else:
                translations = translate_phrase_and_example_with_google(
                    phrase, example_sentence, target_language
                )
        except Exception as e:
            logger.exception('error getting translation')
            raise HTTPException(
                status_code=500,
                detail=f"Failed to translate: {str(e)}"
            )
    
    return {
        "word": phrase,
        "word_translation": translations["phrase_translation"],
        "example_phrase": example_sentence,
        "example_phrase_translation": translations["example_translation"]
    }

def translate_phrase_and_example_with_google(
    phrase: str, 
    example_sentence: str, 
    target_language: str = "en"
) -> Dict[str, str]:
    """
    Translate both phrase and example sentence using Google Translate with proper formatting.
    
    Args:
        phrase: The phrase to translate
        example_sentence: The example sentence to translate
        target_language: Target language code
        
    Returns:
        Dictionary with phrase_translation and example_translation
    """
    
    # Format with context tags for better translation
    formatted_text = f"<phrase>{phrase}</phrase> <phrase_example>{example_sentence}</phrase_example>"
    helper = GoogleTranslateHelper()
    translation = helper.translate(formatted_text, target_language)
    
    # Parse the translation to extract phrase and example translations
    phrase_translation = ""
    example_translation = ""
    
    # Simple parsing - look for the tags in the translation
    if "<phrase>" in translation and "</phrase>" in translation:
        start = translation.find("<phrase>") + 8
        end = translation.find("</phrase>")
        phrase_translation = translation[start:end].strip()
    
    if "<phrase_example>" in translation and "</phrase_example>" in translation:
        start = translation.find("<phrase_example>") + 16
        end = translation.find("</phrase_example>")
        example_translation = translation[start:end].strip()
    
    # Fallback if parsing fails
    if not phrase_translation or not example_translation:
        # Split by space and try to separate
        parts = translation.replace("<phrase>", "").replace("</phrase>", "").replace("<phrase_example>", "").replace("</phrase_example>", "").strip().split()
        if len(parts) >= 2:
            # Rough heuristic: assume first part is phrase translation
            phrase_translation = parts[0]
            example_translation = " ".join(parts[1:])
        else:
            phrase_translation = translation
            example_translation = translation
    
    return {
        "phrase_translation": phrase_translation,
        "example_translation": example_translation
    }
    
        

def translate_phrase_and_example_with_gpt(
    phrase: str, 
    example_sentence: str, 
    target_language: str = "en"
) -> Dict[str, str]:
    """
    Translate both phrase and example sentence using ChatGPT.
    
    Args:
        phrase: The phrase to translate
        example_sentence: The example sentence to translate
        target_language: Target language code
        
    Returns:
        Dictionary with phrase_translation and example_translation
    """
    
    prompt = f"""Translate the following to {target_language}:

    <phrase>{phrase}</phrase>
    <phrase_example>{example_sentence}</phrase_example>

    Provide your translation in the same format:
    <phrase>[phrase translation]</phrase>
    <phrase_example>[example translation]</phrase_example>
    """
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a professional translator. Provide accurate, natural translations maintaining the XML format."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1,
        max_tokens=200
    )
    
    content = response.choices[0].message.content.strip()
    
    # Parse the response
    phrase_translation = ""
    example_translation = ""
    
    if "<phrase>" in content and "</phrase>" in content:
        start = content.find("<phrase>") + 8
        end = content.find("</phrase>")
        phrase_translation = content[start:end].strip()
    
    if "<phrase_example>" in content and "</phrase_example>" in content:
        start = content.find("<phrase_example>") + 16
        end = content.find("</phrase_example>")
        example_translation = content[start:end].strip()
    
    if not phrase_translation or not example_translation:
        raise ValueError("Failed to parse translations from GPT response")
    
    return {
        "phrase_translation": phrase_translation,
        "example_translation": example_translation
    }


def generate_example_sentence_with_gpt(
    phrase: str,
    language: str = "es",
    target_language: str = "en",
    proficiency: str = "intermediate"
) -> Dict[str, str]:
    """
    Generate example sentence using ChatGPT with translation.
    
    Args:
        phrase: The phrase to create example for
        language: Source language
        target_language: Target language for translation
        proficiency: Proficiency level (beginner, intermediate, advanced)
        
    Returns:
        Dictionary with example_phrase, phrase_translation, and example_translation
    """
    
    # Map proficiency to CEFR levels
    proficiency_map = {
        "beginner": "A1-A2",
        "intermediate": "B1-B2", 
        "advanced": "C1-C2"
    }
    
    cefr_level = proficiency_map.get(proficiency, "B1-B2")
    
    # Create prompt for sentence generation with translation
    prompt = f"""Create a simple example sentence in {language} using the phrase "{phrase}". 
    The sentence should be appropriate for {cefr_level} level learners.
    
    Then provide translations to {target_language} for both the phrase and the example sentence.
    
    Format your response as:
    <phrase>{phrase}</phrase>
    <phrase_translation>[phrase translation]</phrase_translation>
    <example_sentence>[example sentence]</example_sentence>
    <example_translation>[example translation]</example_translation>"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a language learning assistant that creates example sentences with translations. Follow the XML format exactly."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=200
        )
        
        content = response.choices[0].message.content.strip()
        
        # Parse the response
        example_phrase = ""
        phrase_translation = ""
        example_translation = ""
        
        if "<example_sentence>" in content and "</example_sentence>" in content:
            start = content.find("<example_sentence>") + 18
            end = content.find("</example_sentence>")
            example_phrase = content[start:end].strip()
        
        if "<phrase_translation>" in content and "</phrase_translation>" in content:
            start = content.find("<phrase_translation>") + 20
            end = content.find("</phrase_translation>")
            phrase_translation = content[start:end].strip()
        
        if "<example_translation>" in content and "</example_translation>" in content:
            start = content.find("<example_translation>") + 21
            end = content.find("</example_translation>")
            example_translation = content[start:end].strip()
        
        if not example_phrase:
            raise ValueError("Failed to parse example sentence from GPT response")
        
        return {
            "example_phrase": example_phrase,
            "phrase_translation": phrase_translation if phrase_translation else phrase,
            "example_translation": example_translation if example_translation else example_phrase
        }
        
    except Exception as e:
        logger.exception(f"Error generating sentence with GPT:")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate example sentence: {str(e)}"
        )