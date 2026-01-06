# Unified Blocks Endpoint Design

## Goal

Replace `/block` and `/question` endpoints with a single `/blocks` endpoint. Both endpoints follow the same pattern:
1. Create user block
2. Save to database
3. Call AI service (OpenAI or QuestionService)
4. Create response block
5. Return created blocks

---

## Key Insight

[`send_note_block`](src/backend/services/notes_service.py:82-232) and [`send_question`](src/backend/services/notes_service.py:454-468) are structurally similar:

**send_note_block:**
- Creates user block with `is_note` flag
- `is_note=True`: Just saves the note, no AI response
- `is_note=False`: Calls OpenAI and gets assistant response
- Returns `{status, new_note_blocks: [user_block, bot_block?]}`

**send_question:**
- Creates question via QuestionService
- QuestionService calls OpenAI with note context and parent block
- Returns structured Q&A with rephrased question title
- Returns `{status, qa_block}`

Both follow the same pattern but serve different purposes:
- `send_note_block`: General note/question flow (existing behavior)
- `send_question`: Structured Q&A with parent reference and title

---

## Backend Changes

### 1. Update Models

```python
# src/backend/models/note.py

class BlockCreate(BaseModel):
    """Unified schema for creating any block type."""
    id: str  # Frontend-generated UUID
    block_type: Literal["note", "question"]
    content: str
    is_note: bool = False
    parent_note_block_id: Optional[str] = None
```

### 2. Update API Endpoint

```python
# src/backend/api/notes.py

@router.post('/{id}/blocks')
def create_block_endpoint(session: SessionDep, id: int, block_data: BlockCreate):
    """Unified endpoint to create note blocks or question blocks."""
    return create_block(session, id, block_data)
```

### 3. Unified Service Function

```python
# src/backend/services/notes_service.py

def create_block(session: Session, note_id: int, block_data: BlockCreate) -> dict:
    """
    Unified service to create any block type.
    Routes to appropriate handler based on block_type.
    """
    
    if block_data.block_type == "note":
        # Delegate to existing send_note_block
        note_block_create = NoteBlockCreate(
            id=block_data.id,
            block=block_data.content,
            is_note=block_data.is_note,
            image_ids=[]
        )
        return send_note_block(session, note_id, note_block_create)
        
    elif block_data.block_type == "question":
        # Delegate to existing send_question
        question_create = QuestionCreate(
            id=block_data.id,
            question=block_data.content,
            parent_note_block_id=block_data.parent_note_block_id
        )
        return send_question(session, note_id, question_create)
```

**Note:** This is a thin routing layer. The actual logic stays in `send_note_block` and `send_question`.

---

## Frontend Changes

### 1. Update API Client

```javascript
// src/frontend/api.js

export const createBlock = async (noteId, blockData) => {
  const response = await api.post(`coach/notes/${noteId}/blocks`, blockData);
  return response.data;
};
```

### 2. Update NoteManager

```javascript
// src/frontend/notewindow/NoteManager.js

async sendBlock(noteId, message, isNote = false, parentNoteBlockId = null) {
  const blockId = uuidv4();
  
  const blockData = {
    id: blockId,
    block_type: isNote ? "note" : "question",
    content: message,
    is_note: isNote,
    parent_note_block_id: parentNoteBlockId
  };
  
  const result = await createBlock(noteId, blockData);
  
  // Handle response based on block_type
  if (isNote) {
    // Result has new_note_blocks array
    this.noteBlocks = [...this.noteBlocks, ...result.new_note_blocks];
  } else {
    // Result has qa_block
    this.noteBlocks = [...this.noteBlocks, result.qa_block];
  }
  
  this.notifyListeners();
}
```

---

## Usage Examples

### Create Note Block

```javascript
await createBlock(noteId, {
  id: uuidv4(),
  block_type: "note",
  content: "Learn Spanish verbs",
  is_note: true,
  parent_note_block_id: null
});
```

### Create Question Block

```javascript
await createBlock(noteId, {
  id: uuidv4(),
  block_type: "question",
  content: "What does this mean?",
  is_note: false,
  parent_note_block_id: "parent-block-uuid"
});
```

---

## Benefits

1. Single endpoint for all block creation
2. Consistent API pattern
3. Easy to understand: `/blocks` creates blocks
4. Frontend generates UUIDs for all blocks
5. Backend routes to appropriate service based on `block_type`
