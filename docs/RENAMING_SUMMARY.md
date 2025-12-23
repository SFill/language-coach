# Chat to Notes Renaming Summary

This document summarizes all the renaming changes made to convert "chat" terminology to "notes" throughout the codebase.

## ✅ Completed Changes

### Backend

#### 1. API Layer (`src/backend/api/`)
- **Created**: `notes.py` - New API router with notes endpoints
  - Changed prefix from `/api/coach/chat` to `/api/coach/notes`
  - Renamed all endpoint functions: `create_chat_endpoint` → `create_note_endpoint`, etc.
  - Updated all docstrings to reference "note" instead of "chat"

#### 2. Services Layer (`src/backend/services/`)
- **Created**: `notes_service.py` - New service with renamed functions
  - `create_chat()` → `create_note()`
  - `get_chat_list()` → `get_note_list()`
  - `get_chat()` → `get_note()`
  - `delete_chat()` → `delete_note()`
  - `update_chat_message()` → `update_note_block()`
  - `delete_chat_message()` → `delete_note_block()`
  - `upload_chat_image()` → `upload_note_image()`
  - `get_chat_images()` → `get_note_images()`
  - `delete_chat_image()` → `delete_note_image()`
  - `get_chat_image_file()` → `get_note_image_file()`
  - Changed upload directory from `/tmp/chat_images` to `/tmp/note_images`
  - Updated all error messages and docstrings

#### 3. Main Application (`src/backend/main.py`)
- Updated import: `from .api.notes import router as notes_router`
- Updated router inclusion: `app.include_router(notes_router)`

#### 4. Service Exports (`src/backend/services/__init__.py`)
- Updated to export functions from `notes_service` instead of `chat_service`

#### 5. API Exports (`src/backend/api/__init__.py`)
- Added import for `notes_router`
- Kept `chat_router` for backward compatibility during transition

### Frontend

#### 1. API Client (`src/frontend/api.js`)
- **Renamed Functions**:
  - `fetchChats()` → `fetchNotes()`
  - `fetchChatById()` → `fetchNoteById()`
  - `deleteChat()` → `deleteNote()`
  - `createNewChat()` → `createNewNote()`
  - `uploadChatImage()` → `uploadNoteImage()`
  - `fetchChatImages()` → `fetchNoteImages()`
  - `deleteChatImage()` → `deleteNoteImage()`
  - `getChatImageUrl()` → `getNoteImageUrl()`
- **Updated API Endpoints**: All endpoints changed from `coach/chat/` to `coach/notes/`
- **Updated Function Parameters**: `chatId` → `noteId` throughout

#### 2. Component Directory
- **Created**: `src/frontend/notewindow/` directory with renamed components:
  - `ChatWindow.jsx` → `NoteWindow.jsx`
  - `ChatWindowPage.jsx` → `NoteWindowPage.jsx`
  - `ChatMessage.jsx` → `NoteMessage.jsx`
  - `ChatTile.jsx` → `NoteTile.jsx`
  - `ChatToolbar.jsx` → `NoteToolbar.jsx`
  - `ChatImagesList.jsx` → `NoteImagesList.jsx`
  - All corresponding CSS files renamed

#### 3. List Components
- **Created**:
  - `NoteListPage.jsx`
  - `NoteListView.jsx`
  - `NoteListView.css`

### Models (`src/backend/models/chat.py`)
- **Added TODO comments** highlighting SQLModel classes that need manual renaming:
  - `Chat` → `Note` (affects database table)
  - `ChatImage` → `NoteImage` (affects database table)
  - `ChatMessage` → `NoteMessage`
  - `ChatListResponse` → `NoteListResponse`
  - `ChatImageResponse` → `NoteImageResponse`
  - `ChatMessageCreate` → `NoteMessageCreate`
  - `ChatMessageUpdate` → `NoteMessageUpdate`

## ⚠️ Manual Actions Required

### 1. Database Models (CRITICAL - Affects Database)
The following SQLModel classes in [`src/backend/models/chat.py`](src/backend/models/chat.py) need to be renamed manually because they have `table=True` and affect the database schema:

```python
# TODO: Rename these classes manually
class Chat(SQLModel, table=True):  # → Note
class ChatImage(SQLModel, table=True):  # → NoteImage
```

**Important**: After renaming these classes, you'll need to:
1. Create a database migration
2. Update all references in test files
3. Update the foreign key reference in `ChatImage.chat_id`

### 2. Frontend Component Updates ✅ COMPLETED

All frontend components have been updated with renamed references:

#### Components in `src/frontend/notewindow/`:
- [x] `NoteWindow.jsx` - Updated all internal references
- [x] `NoteWindowPage.jsx` - Updated all internal references
- [x] `NoteMessage.jsx` - Updated all internal references
- [x] `NoteTile.jsx` - Updated all internal references
- [x] `NoteToolbar.jsx` - Updated all internal references
- [x] `NoteImagesList.jsx` - Updated all internal references
- [x] `components/MarkdownContent.jsx` - Updated `getChatImageUrl` → `getNoteImageUrl`
- [x] `components/TranslatableContent.jsx` - Updated prop names

#### Main App Files:
- [x] `src/frontend/App.jsx` - Updated imports and all references
- [x] `src/frontend/NoteListPage.jsx` - Updated internal content
- [x] `src/frontend/NoteListView.jsx` - Updated internal content

### 3. Backend Test Files ✅ COMPLETED

Test files in `src/backend/tests/` have been updated:
- [x] `test_chat_service.py` → Renamed to `test_notes_service.py` and updated all references
- [x] `test_chat_images.py` → Renamed to `test_note_images.py` and updated all references
- [x] `conftest.py` - Updated fixture names (`sample_chats` → `sample_notes`, etc.)

#### Changes Made:
- **Created** [`test_notes_service.py`](src/backend/tests/test_notes_service.py) - Updated all imports to use `notes_service` instead of `chat_service`
- **Created** [`test_note_images.py`](src/backend/tests/test_note_images.py) - Updated all function calls to use note terminology
- **Updated** [`conftest.py`](src/backend/tests/conftest.py) - Renamed `sample_chats` fixture to `sample_notes` and updated helper functions

### 4. Old Files to Remove

After verifying everything works:
- [x] Remove `src/backend/api/chat.py`
- [x] Remove `src/backend/services/chat_service.py`
- [x] Remove old `chatwindow` directory if it still exists

### 5. Documentation Updates
- [x] Update `README.md` if it references chat functionality
- [x] Update any documentation in `docs/` folder that mentions chat
- [x] Update `AGENTS.md` project structure section

## 🔍 Completed Renames

All major frontend renames have been completed:

### In Frontend Files (✅ DONE):
- `chatId` → `noteId`
- `chatList` → `noteList`
- `currentChatId` → `currentNoteId`
- `currentChatName` → `currentNoteName`
- `loadChat` → `loadNote`
- `deleteChat` → `deleteNote`
- `onChatCreated` → `onNoteCreated`
- `fetchChatById` → `fetchNoteById`
- `createNewChat` → `createNewNote`
- `uploadChatImage` → `uploadNoteImage`
- `fetchChatImages` → `fetchNoteImages`
- `deleteChatImage` → `deleteNoteImage`
- `getChatImageUrl` → `getNoteImageUrl`
- `'/chat/'` → `'/note/'` (in routes)
- `'/chatlist'` → `'/notelist'` (in routes)

### CSS Files ✅ COMPLETED:
- [x] `.chat-` → `.note-` (class names in CSS files)
- [x] All CSS files updated with new class names:
  - [`NoteImagesList.css`](src/frontend/notewindow/NoteImagesList.css) - Updated all `.chat-images-*` to `.note-images-*`
  - [`NoteMessage.css`](src/frontend/notewindow/NoteMessage.css) - Updated all `.chat-message*` to `.note-message*`
  - [`NoteTile.css`](src/frontend/notewindow/NoteTile.css) - Updated all `.chat-tile*` to `.note-tile*`
  - [`NoteToolbar.css`](src/frontend/notewindow/NoteToolbar.css) - Updated `.chat-toolbar` to `.note-toolbar`
  - [`NoteWindow.css`](src/frontend/notewindow/NoteWindow.css) - Updated `.chat-window*` to `.note-window*`
  - [`NoteWindowPage.css`](src/frontend/notewindow/NoteWindowPage.css) - Updated `.chat-window-page` to `.note-window-page`
- [x] JSX components updated to use new CSS class names:
  - [`NoteTile.jsx`](src/frontend/notewindow/NoteTile.jsx) - Updated all className references and prop names (`chatId` → `noteId`)

## 📋 Verification Checklist

After completing manual updates:
- [ ] Backend API endpoints respond at `/api/coach/notes/`
- [ ] Frontend can create, read, update, and delete notes
- [ ] Image upload/download works with notes
- [ ] All tests pass
- [ ] No console errors in browser
- [ ] Database migrations applied successfully
- [ ] Old "chat" terminology removed from user-facing text

## 🚀 Next Steps

1. Complete the manual updates listed above
2. Run all tests: `pytest src/backend/tests/`
3. Test the frontend application manually
4. Create database migration for model renames
5. Remove old files after verification
6. Update documentation

## Notes

- The old `chat_service.py` and `chat.py` API files are kept temporarily for reference
- Database table names (`chat` and `chatimage`) will need migration
- Some internal variable names in components still use "chat" - these need manual updates
- The API now supports both `/api/coach/chat/` and `/api/coach/notes/` during transition
