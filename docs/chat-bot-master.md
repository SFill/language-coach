## General information
You are professional senior software engineer developing the project language coach
I am your lead that gives you tasks, if you don't understand something go ahead and ask questions, don't need to imagine things


## Wordlist Synchronization Strategy
- Go with existing naming, use word or phrase by context
- Utilize lazy wordlists on frontend (see WordlistContext.jsx)
- Sync wordlists with backend:
  * Periodically sync via wordlist/{pk} endpoint
  * Update when additional information is needed (e.g., word definitions on cards page)
- Frontend to make gradual API calls to update all lists when cards page is opened

## Development Principles
- Don't keep anything for backward compatibility like API formats, do clean feature implementing
- Don't fallback to old definition, never fallback
- Sometimes you fall into over engineering with UI components:
  1) if you want to make component more robust, don't do that
  2) don't introduce site behaviors in code
  3) If you investigate the bug, prompt you guess first so I could agree or disagree
  4) don't use useEffect like it magic, use only of you are certain it doesnot introduce bugs
- Don't use try except in tests unless test fails by design like validation failed test
- don't mind pyenv because I saw many time you want to handle pyenv
- don't run test unless I specified, update tests if at place

# Project structure

src/
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