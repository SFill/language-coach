import requests
from bs4 import BeautifulSoup
import json
import re
from typing import Dict, List, Optional, Union, Any


class SpanishDictClient:
    """
    A client for parsing and extracting information from SpanishDict.com
    """
    
    BASE_URL = "https://www.spanishdict.com"
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
    }
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(self.HEADERS)
    
    def get_word_data(self, word: str) -> Dict[str, Any]:
        """
        Get comprehensive data for a specific word
        
        Args:
            word: The word to look up
            
        Returns:
            Dictionary containing all available information about the word
        """
        url = f"{self.BASE_URL}/translate/{word}"
        response = self.session.get(url)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract initial state data if available
        data = self._extract_initial_state(soup)
            
        return data['sdDictionaryResultsProps']['entry']['neodict']
    
    def _extract_initial_state(self, soup: BeautifulSoup) -> Dict[str, Any]:
        """
        Extract data from the initial state JSON if available
        """
        try:
            # Look for the script that contains the initial state data
            for script in soup.find_all('script'):
                if script.string and 'window.SD_COMPONENT_DATA' in script.string:
                    # Extract the JSON data
                    json_str = re.search(r'window\.SD_COMPONENT_DATA\s*=\s*({.*});', script.string, re.DOTALL)
                    if json_str:
                        return json.loads(json_str.group(1))
        except (json.JSONDecodeError, AttributeError) as e:
            print(f"Error extracting initial state: {e}")
        
        return {}
        
    def get_conjugations(self, verb: str) -> Dict[str, Any]:
        """
        Get conjugation tables for a verb
        
        Args:
            verb: The verb to look up conjugations for
            
        Returns:
            Dictionary containing conjugation tables
        """
        url = f"{self.BASE_URL}/conjugate/{verb}"
        response = self.session.get(url)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Try to extract from initial state first
        data = self._extract_initial_state(soup)
        
        # Check if verb data is available in the extracted data
        if not (data and "verb" in data and "paradigms" in data["verb"]):
            return 
        paradigms = data["verb"]["paradigms"]
        
        # Process the paradigms into a more user-friendly format
        result = {
            "infinitive": data["verb"].get("infinitive", verb),
            "translation": data["verb"].get("infinitiveTranslation", ""),
            "isReflexive": data["verb"].get("isReflexive", False),
            "tenses": {}
        }
        
        # Add participles if available
        if "pastParticiple" in data["verb"]:
            result["pastParticiple"] = {
                "spanish": data["verb"]["pastParticiple"].get("word", ""),
                "english": data["verb"]["pastParticiple"].get("wordTranslation", {}).get("word", "")
            }
            
        if "gerund" in data["verb"]:
            result["gerund"] = {
                "spanish": data["verb"]["gerund"].get("word", ""),
                "english": data["verb"]["gerund"].get("wordTranslation", {}).get("word", "")
            }
        
        # Process each tense
        for tense_name, conjugations in paradigms.items():
            # Create a new dictionary for this tense
            tense_dict = {}
            
            # Process each conjugation form
            for conj in conjugations:
                pronoun = conj.get("pronoun", "")
                if pronoun and "word" in conj:
                    # Handle multiple forms (comma-separated)
                    forms = conj["word"].split(",") if "," in conj["word"] else [conj["word"]]
                    
                    # Get translation if available
                    translation = ""
                    if "wordTranslation" in conj and "word" in conj["wordTranslation"]:
                        translation = conj["wordTranslation"]["word"]
                    
                    tense_dict[pronoun] = {
                        "forms": forms,
                        "translation": translation
                    }
            
            # Add this tense to the result if it has any entries
            if tense_dict:
                result["tenses"][tense_name] = tense_dict
        
        return result
            
        
    
    def get_examples(self, word: str, limit: int = 10) -> List[Dict[str, str]]:
        """
        Get usage examples for a word
        
        Args:
            word: The word to find examples for
            limit: Maximum number of examples to return
            
        Returns:
            List of example sentences
        """
        # TODO doesnot work
        url = f"{self.BASE_URL}/examples/{word}"
        response = self.session.get(url)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        examples = []
        example_divs = soup.select("div.example")
        
        for div in example_divs[:limit]:
            spanish = div.select_one(".spanish")
            english = div.select_one(".english")
            
            if spanish and english:
                examples.append({
                    "spanish": spanish.get_text(strip=True),
                    "english": english.get_text(strip=True)
                })
        
        return examples


# Example usage
if __name__ == "__main__":
    client = SpanishDictClient()
    
    # Example 1: Get word data
    word_data = client.get_word_data("hablando")
    print("Word data for 'api':")
    # print(json.dumps(word_data, indent=2, ensure_ascii=False))
    
    # Example 2: Get conjugations for a verb
    conjugations = client.get_conjugations("hablar")
    # print("\nConjugations for 'hablar':")
    print(conjugations)
    
    # # Print a more readable sample of the conjugations
    # if conjugations and "tenses" in conjugations:
    #     print(f"Infinitive: {conjugations['infinitive']} - Translation: {conjugations['translation']}")
        
    #     # Print present indicative tense as an example
    #     if "presentIndicative" in conjugations["tenses"]:
    #         print("\nPresent Indicative:")
    #         present_tense = conjugations["tenses"]["presentIndicative"]
    #         for pronoun, data in present_tense.items():
    #             forms = ", ".join(data["forms"])
    #             translation = data["translation"]
    #             print(f"  {pronoun}: {forms} ({translation})")
                
    #     # Print preterite indicative tense as another example
    #     if "preteritIndicative" in conjugations["tenses"]:
    #         print("\nPreterite Indicative:")
    #         preterite_tense = conjugations["tenses"]["preteritIndicative"]
    #         for pronoun, data in preterite_tense.items():
    #             forms = ", ".join(data["forms"])
    #             translation = data["translation"]
    #             print(f"  {pronoun}: {forms} ({translation})")
        
    #     # Show available tenses
    #     print("\nAvailable tenses:")
    #     for tense in conjugations["tenses"].keys():
    #         print(f"  - {tense}")
    # else:
    #     print(json.dumps(conjugations, indent=2, ensure_ascii=False))
    
    
    # Example 4: Get examples
    examples = client.get_examples("casa")
    print("\nExamples for 'casa':")
    print(json.dumps(examples, indent=2, ensure_ascii=False))
    