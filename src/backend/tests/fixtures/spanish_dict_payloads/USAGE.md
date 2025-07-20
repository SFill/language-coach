# Real Spanish Dictionary Payloads for Testing

This directory contains real API responses from SpanishDict.com that can be used for testing the Spanish dictionary service.

## What's Included

### Words with Full Data
- **hola** - Simple interjection (greeting)
- **casa** - Feminine noun (house) 
- **correr** - Regular -er verb (to run)
- **ser** - Irregular verb (to be)
- **bueno** - Adjective (good)
- **agua** - Noun with special article usage (water)
- **hablar** - Regular -ar verb (to speak/talk)
- **comer** - Regular -er verb (to eat)
- **vivir** - Regular -ir verb (to live)
- **perro** - Masculine noun (dog)
- **grande** - Adjective (big/large)
- **rápido** - Adjective/adverb (fast/quickly)

### File Types
- `{word}_word_data.json` - Dictionary definitions, translations, examples
- `{word}_audio_data.json` - Audio URLs and pronunciation data
- `{word}_conjugations.json` - Verb conjugation tables (verbs only)

## Usage in Tests

### Using the Fixture Loader

```python
from backend.tests.fixtures.spanish_dict_loader import SpanishDictFixtures

# Load data for any word
word_data, audio_data = SpanishDictFixtures.load_complete_word_data("hola")

# Load conjugations for verbs
conjugations = SpanishDictFixtures.load_conjugations("correr")

# Get available words and verbs
words = SpanishDictFixtures.get_available_words()
verbs = SpanishDictFixtures.get_available_verbs()
```

### Using Convenience Functions

```python
from backend.tests.fixtures.spanish_dict_loader import get_hola_data, get_correr_conjugations

# Get specific word data
word_data, audio_data = get_hola_data()

# Get specific conjugation data
conjugations = get_correr_conjugations()
```

### Using in Test Files

```python
def test_with_real_payload(self):
    # Mock the API to return real data
    with patch('backend.services.dict_spanish_service.SpanishDictClient.get_word_data') as mock_get:
        word_data, audio_data = get_hola_data()
        mock_get.return_value = (word_data, audio_data)
        
        # Test your service with real data
        result = get_spanish_word_definition(["hola"], session=test_session)
        # ... assertions
```

## Key Features of Real Data

### Realistic Content
- Actual Spanish grammar and usage patterns
- Real pronunciation data with audio URLs
- Complete conjugation tables for verbs
- Genuine examples and translations

### Edge Cases
- **agua**: Shows "el agua" (feminine noun with masculine article)
- **casa**: Shows "la casa" (includes feminine article)
- **ser**: Irregular verb conjugations
- **reflexive flags**: API uses numeric values (e.g., 2) for reflexive indicators

### API Response Format
The payloads match the exact structure returned by SpanishDict.com:
- Complex nested JSON with multiple translation senses
- Audio data with regional pronunciation variants (US/UK for English)
- Conjugation data with all tenses and pronouns
- Rich metadata including part-of-speech, gender, context

## Benefits for Testing

1. **Realistic Data**: Tests work with actual API response structures
2. **Edge Case Coverage**: Real data includes linguistic edge cases
3. **Regression Prevention**: Changes to parsing logic are tested against real data
4. **No Network Dependency**: Tests run offline using cached responses
5. **Consistent Results**: Same data across test runs

## Updating Payloads

To refresh the payloads with current API data:

```bash
python fetch_spanish_dict_payloads.py
```

This will re-download all payloads and update the fixture files.