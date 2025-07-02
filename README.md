# Language Coach


### 🎯 Purpose of the App:
Language Coach helps users improve their language skills by working with foreign-language texts using GPT-based assistance. The core goal is to support reading, translating, note-taking, and smart prompting to deepen understanding.

---

### ⚙️ Tech Stack:
- **Frontend**: React (JavaScript)
- **Styling**: Simple CSS (no frameworks)
- **Backend**: FastAPI (Python)
- **ORM**: SQLAlchemy
- **Database**: SQLite (PostgreSQL planned later)
- **Containerization**: Docker
- **Authentication**: None
- **AI Integration**: OpenAI API (ChatGPT for now, Whisper planned)
- **Environments**: local, dev, prod

---

### ✅ Features Currently Implemented:
- Text-based chat with GPT assistant
- Multi-language support with language selection in navbar (English, Spanish)
- Messages can be posted as either **notes** or **questions**
- Selected text from study material can be sent to the chatbot as a question
- Translation helper to get meaning of unknown words with one-click copy functionality
- Input field for writing notes during text study, with VS Code-like scrolling behavior
- Markdown rendering for formatted text
- Wordlist management with real-time sync to backend
- Dictionary integration for both English and Spanish with:
  - Word definitions and translations
  - Audio pronunciation
  - Conjugation tables for Spanish verbs
  - Examples and usage notes
- Chat management (create, view, delete chats)
- Keyboard shortcuts:
  - Text formatting (Ctrl+B for bold, Ctrl+I for italic, Ctrl+K for code)
  - Clear translation area with backspace or Ctrl+E
  - Tab key inserts 4 spaces
  - Undo/Redo functionality (Ctrl+Z, Ctrl+Y/Ctrl+Shift+Z) - currently disabled
- Persistent text input (saved across page reloads)
- Improved UI with navbar showing current chat name
- Word deletion functionality from word lists - wordlist deletion is not supported so far

---

### 🛠️ Features Planned or In Progress:
- New UI with professional design, and sophisticated UX
- Edit posted notes/messages using the existing MessageInput component
- Auto-scroll chat to the newest message
- Display message counter
- Export chat history to `.md` (for Obsidian)
- Voice features: TTS (text-to-speech) and Whisper for speech input
- "Repeat a phrase" speaking practice with voice input
- Export saved word list for spaced repetition system (used in a separate app)
- Internal prompt collections (to assist development with GPT)
- RAG-style features to scan lessons/notes for insights
- Backend: optimize API responses to exclude large/unnecessary fields
- Optimize wordlist performance for better speed


### Project structure:


```
language-coach/
├── backend/
│   ├── api/
│   │   ├── __init__.py
│   │   ├── chat.py             # Chat endpoints
│   │   ├── dictionary.py       # Dictionary lookup endpoints
│   │   ├── sentence.py         # Example sentence retrieval endpoints
│   │   ├── translation.py      # Translation endpoints
│   │   └── wordlist.py         # Wordlist management endpoints
│   ├── downloader/             # Gutenberg books downloader module
│   │   ├── __init__.py
│   │   ├── db_integration.py   # Import books to database
│   │   ├── gutenberg_downloader.py # Downloads books from Gutenberg
│   │   └── requirements.txt    # Downloader dependencies
│   ├── models/
│   │   ├── __init__.py
│   │   ├── chat.py             # Chat data models
│   │   ├── dict_english.py     # English dictionary models
│   │   ├── dict_spanish.py     # Spanish dictionary models
│   │   └── wordlist.py         # Wordlist data models
│   ├── services/
│   │   ├── __init__.py
│   │   ├── chat_service.py     # Chat service with GPT integration
│   │   ├── dict_spanish_service.py  # Spanish dictionary service
│   │   ├── dictionary_service.py    # English dictionary service
│   │   ├── sentence/           # Sentence retrieval services
│   │   │   ├── __init__.py
│   │   │   ├── db_models.py    # Database models for corpus
│   │   │   ├── gdex.py         # Good Dictionary Examples scoring
│   │   │   ├── sentence_retriever.py # Sentence search and retrieval
│   │   │   └── sentence_service.py   # Service layer for sentence retrieval
│   │   ├── translation_service.py    # Translation service
│   │   └── unified_dictionary_service.py  # Combined dictionary interface
│   ├── __init__.py
│   ├── constants.py            # System prompts and constants
│   ├── database.py             # Database connection setup
│   └── main.py                 # FastAPI main application
├── frontend/
│   ├── assets/
│   │   └── react.svg
│   ├── chatwindow/             # Chat interface components
│   │   ├── components/         # Reusable chat components
│   │   ├── ChatMessage.jsx     # Chat message component
│   │   ├── ChatToolbar.jsx     # Selection toolbar component
│   │   ├── ChatWindow.jsx      # Main chat window component
│   │   └── ChatWindowPage.jsx  # Chat page container
│   ├── MessageInput/           # Advanced text input component
│   │   ├── hooks/              # Custom hooks for input behavior
│   │   ├── index.jsx           # Main component export
│   │   ├── SelectionToolbar.jsx # Text selection toolbar
│   │   └── TextEditor.jsx      # Core text editor component
│   ├── wordlist/               # Wordlist management components
│   │   ├── ReverseContext.jsx     # Word context examples
│   │   ├── ReverseContext.module.css  # Modular CSS for context examples
│   │   ├── WordListPage.jsx    # Wordlist page container
│   │   ├── WordLists.jsx       # List of word collections
│   │   ├── WordlistContext.jsx # State management for wordlists
│   │   └── utils.js            # Wordlist helper functions
│   ├── hooks/                  # App-wide custom hooks
│   ├── App.jsx                 # Main React app component
│   ├── api.js                  # API client functions
│   ├── main.jsx                # React entry point
│   └── SideDictionaryPanel.jsx # Dictionary lookup panel
├── docker-compose.yml          # Docker setup for deployment
├── requirements.txt            # Python dependencies
└── README.md       

```