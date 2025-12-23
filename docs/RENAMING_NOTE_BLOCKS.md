# Note Blocks Renaming Summary

This document summarizes the renaming from "message" terminology to "note_block" / "noteBlock" terminology across the frontend and backend codebase.

## Frontend Files Modified

### 1. `src/frontend/notewindow/NoteWindowPage.jsx`
**Changes:**
- `messages` state → `noteBlocks`
- `setMessages` → `setNoteBlocks`
- `maxMessageId` → `maxNoteBlockId`
- `setMaxMessageId` → `setMaxNoteBlockId`
- `messageInputRef` → `noteBlockInputRef`
- `initialMessage` → `initialNoteBlock`
- `userMessage` → `userNoteBlock`
- `newMessageId` → `newNoteBlockId`
- `sendMessage` import → `sendNoteBlock`
- All function parameters and variables updated accordingly

### 2. `src/frontend/notewindow/NoteWindow.jsx`
**Changes:**
- `messages` prop → `noteBlocks`
- `messageInputRef` prop → `noteBlockInputRef`
- `messageRefs` → `noteBlockRefs`
- `activeMessageRef` → `activeNoteBlockRef`
- `setActiveMessageRef` → `setActiveNoteBlockRef`
- `messageContainer` → `noteBlockContainer`
- `msg` variable → `block`
- `messageTiles` → `blockTiles`
- Component import: `NoteMessage` → `NoteBlock`
- All comments updated to reference "note blocks" instead of "messages"

### 3. `src/frontend/notewindow/NoteMessage.jsx` → `src/frontend/notewindow/NoteBlock.jsx`
**Changes:**
- File renamed from `NoteMessage.jsx` to `NoteBlock.jsx`
- Component name: `NoteMessage` → `NoteBlock`
- `msg` prop → `block`
- `messageId` → `noteBlockId`
- `updateMessage` → `updateNoteBlock`
- `deleteMessage` → `deleteNoteBlock`
- Component displayName updated
- PropTypes updated to use `block` instead of `msg`
- All internal references and comments updated

### 4. `src/frontend/api.js`
**Changes:**
- `updateMessage()` → `updateNoteBlock()`
- `deleteMessage()` → `deleteNoteBlock()`
- `sendMessage()` → `sendNoteBlock()`
- `messageId` parameter → `noteBlockId`
- `userMessage` variable → `userNoteBlock`
- Error messages updated to reference "note block"
- Comments updated

## Files Renamed

- `src/frontend/notewindow/NoteMessage.jsx` → `src/frontend/notewindow/NoteBlock.jsx`
- `src/frontend/notewindow/NoteMessage.css` → `src/frontend/notewindow/NoteBlock.css`

## Unchanged References (Intentional)

The following references were NOT changed as they serve different purposes:

1. **CSS Class Names**: Class names within the CSS file (e.g., `.note-message`, `.note-container`) remain unchanged to avoid breaking existing styles
2. **MessageInput Component**: Separate component for text input, not related to note blocks
3. **Backend API Response Fields**: `new_note_blocks`, `max_message_id` - these are backend field names that will be updated separately
4. **Backend API Endpoints**: `/message/` paths - these are backend routes that will be updated separately

## Context

In the note system:
- **note_blocks** (backend) / **noteBlocks** (frontend): The data structure representing both notes and questions/answers
- **Notes**: User-created content blocks with `is_note: true`
- **Questions/Answers**: Follow-up Q&A blocks with `is_note: false`

The renaming clarifies that we're working with note blocks rather than generic messages, aligning with the backend data model.

## Testing Recommendations

1. Verify note creation and display
2. Test note editing and deletion
3. Verify question/answer functionality
4. Check that all toolbar actions work correctly
5. Ensure wordlist integration still functions
6. Test image upload and reference insertion

