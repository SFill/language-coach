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