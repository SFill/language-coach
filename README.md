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
- Messages can be posted as either **notes** or **questions**
- Selected text from study material can be sent to the chatbot as a question
- Translation helper to get meaning of unknown words
- Input field for writing notes during text study, Input field auto-expands to fit content (prevent jump) and works nice with large notes  

---

### 🛠️ Features Planned or In Progress:
- New UI with professional deisgn, and sofisticated UX
- Edit posted notes/messages using the existing MessageInput component  
- Save vocabulary words for review  
- Manual tracking of “Words we learned today”  
- Auto-scroll chat to the newest message  
- Keyboard shortcuts: clear translation area with backspace  
- Tab key = insert 4 spaces  
- Display message counter and chat title  
- Export chat history to `.md` (for Obsidian)  
- Voice features: TTS (text-to-speech) and Whisper for speech input  
- “Repeat a phrase” speaking practice with voice input  
- Integration with external dictionary APIs (WordsAPI, Merriam-Webster)  
- Export saved word list for spaced repetition system (used in a separate app)  
- Internal prompt collections (to assist development with GPT)  
- RAG-style features to scan lessons/notes for insights  
- Backend: optimize API responses to exclude large/unnecessary fields  
- Restore ability to create chat from scratch (lost after refactor)  
- Implement DELETE method for chat sessions  
- Hotkeys for markdown-style formatting (italic, bold)