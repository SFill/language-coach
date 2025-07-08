# Backend Scripts

This directory contains utility scripts for database migrations and maintenance.

## migrate_wordlists.py

Migrates wordlists from the old format (list of strings) to the new WordInList format with translations and examples.

### Usage

```bash
# Check what would be migrated (dry run)
python migrate_wordlists.py --dry-run

# Migrate all wordlists using Google Translate
python migrate_wordlists.py

# Migrate using GPT for translation
python migrate_wordlists.py --use-gpt-translation

# Migrate only Spanish wordlists
python migrate_wordlists.py --language es

# Migrate specific wordlist by ID
python migrate_wordlists.py --wordlist-id 123

# Combine options
python migrate_wordlists.py --dry-run --language es --use-gpt-translation
```

### Requirements

- Database connection configured
- OPENAI_API_KEY environment variable set (if using --use-gpt-translation)
- All backend dependencies installed

### What it does

1. Finds wordlists in old format: `["word1", "word2", ...]`
2. For each word, generates:
   - Translation to English
   - Example sentence in the source language
   - Translation of the example sentence
3. Updates database with new format: `[{"word": "...", "word_translation": "...", "example_phrase": "...", "example_phrase_translation": "..."}]`

### Safety

- Always run with `--dry-run` first to see what will be changed
- The script handles errors gracefully and logs all operations
- Failed word processing falls back to basic structure with null fields