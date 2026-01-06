# Migration Document: Numeric IDs to UUIDs for Note Blocks

## Overview

This document outlines the migration strategy to replace numeric note block IDs with UUIDs, solving the first-block linking problem and enabling frontend-generated IDs.

**Goal:** Enable frontend to generate permanent UUIDs for note blocks, eliminating ID synchronization issues and allowing questions to reference blocks before server confirmation.

---

## Migration Strategy

### Phase 1: Add UUID Support (Backward Compatible)

**Duration:** 1-2 days  
**Risk:** Low (additive changes only)

#### Backend Changes

**1. Update [`NoteBlock`](src/backend/models/note.py:8-24) model:**

```python
from uuid import UUID
import uuid

class NoteBlock(BaseModel):
    """Schema representing a message stored in note history."""
    id: str  # Changed from int to str (UUID)
    role: Literal["user", "assistant", "system", "developer"]
    content: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_note: bool = False
    parent_note_block_id: Optional[str] = None  # Changed from int to str
    block_type: Optional[str] = None
    question_title: Optional[str] = None
    
    @computed_field
    @property
    def image_ids(self) -> List[int]:
        """Parse image IDs from content dynamically."""
        return [int(img_id) for img_id in re.findall(r'@image:(\d+)', self.content)]
```

**2. Update [`Note`](src/backend/models/note.py:27-48) model:**

```python
class Note(SQLModel, table=True):
    """Model for note sessions."""
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    history: dict = Field(default_factory=lambda: {'content': []}, sa_column=Column(JSON))
    images: List["NoteImage"] = Relationship(back_populates="note")
    # Remove max_message_id - no longer needed
    
    @computed_field
    @property
    def note_blocks(self) -> list[NoteBlock]:
        return [NoteBlock.model_validate(msg) for msg in self.history['content']]
    
    # Remove get_new_note_block_id() - frontend generates UUIDs
```

**3. Update [`NoteBlockCreate`](src/backend/models/note.py:78-82):**

```python
class NoteBlockCreate(BaseModel):
    """Schema for creating note messages."""
    id: str  # Frontend-generated UUID
    block: str
    is_note: bool = False
    image_ids: List[int] = PydanticField(default_factory=list)
```

**4. Update [`QuestionCreate`](src/backend/models/note.py:90-93):**

```python
class QuestionCreate(BaseModel):
    """Schema for creating a question about a note."""
    id: str  # Frontend-generated UUID for the Q&A block
    question: str
    parent_note_block_id: Optional[str] = None  # UUID reference
```

**5. Update [`send_note_block`](src/backend/services/notes_service.py:82-232) in notes_service.py:**

```python
def send_note_block(session: Session, id: int, note_block: NoteBlockCreate) -> dict:
    """Send a note block to a note session and get response."""
    # ... existing image processing code ...
    
    timestamp = datetime.utcnow()
    user_note_block = NoteBlock(
        id=note_block.id,  # Use frontend-provided UUID
        role="user",
        content=history_content,
        created_at=timestamp,
        updated_at=timestamp,
        is_note=note_block.is_note,
        image_ids=extracted_image_ids,
    )
    
    # ... rest of function unchanged ...
    
    if assistant_response:
        assistant_timestamp = datetime.utcnow()
        assistant_note_block = NoteBlock(
            id=str(uuid.uuid4()),  # Generate UUID for assistant response
            role="assistant",
            content=assistant_response,
            created_at=assistant_timestamp,
            updated_at=assistant_timestamp,
        )
```

**6. Update [`QuestionService`](src/backend/services/question_service.py) `_create_qa_block`:**

```python
def _create_qa_block(
    self,
    block_id: str,  # Accept UUID from frontend
    title: str,
    answer: str,
    parent_note_block_id: Optional[str],
    timestamp: datetime
) -> NoteBlock:
    """Create a Q&A response block."""
    return NoteBlock(
        id=block_id,  # Use provided UUID
        role="assistant",
        content=answer,
        question_title=title,
        is_note=False,
        parent_note_block_id=parent_note_block_id,
        block_type="qa_response",
        created_at=timestamp,
        updated_at=timestamp
    )
```

**7. Update [`update_note_block`](src/backend/services/notes_service.py:249-292) and [`delete_note_block`](src/backend/services/notes_service.py:295-312):**

```python
def update_note_block(
    session: Session,
    note_id: int,
    note_block_id: str,  # Changed from int to str
    payload: NoteBlockUpdate,
) -> dict:
    # ... existing code, ID comparison now uses string ...
    target_note_block = get_first(
        content, 
        key=lambda block: NoteBlock.model_validate(block).id == note_block_id
    )
    # ... rest unchanged ...

def delete_note_block(session: Session, note_id: int, note_block_id: str) -> dict:
    # ... existing code with string ID ...
    content = list(filter(
        lambda block: NoteBlock.model_validate(block).id != note_block_id, 
        content
    ))
```

#### Frontend Changes

**1. Update [`NoteManager.js`](src/frontend/notewindow/NoteManager.js):**

```javascript
import { v4 as uuidv4 } from 'uuid';

class NoteManager {
  constructor() {
    this.noteBlocks = [];
    // Remove maxNoteBlockId - no longer needed
    this.isLoadingNote = false;
    this.listeners = [];
    this.onNoteCreatedCallback = null;
  }

  async sendBlock(noteId, message, isNote = false, parentNoteBlockId = null) {
    if (!message.trim()) return;
    if (!noteId) {
      throw new Error('Note ID is required to send a block');
    }

    // Generate UUID immediately
    const blockId = uuidv4();
    const userNoteBlock = {
      sender: 'user',
      content: message.trim(),
      id: blockId,  // UUID instead of numeric
      is_note: isNote
    };
    this.noteBlocks = [...this.noteBlocks, userNoteBlock];
    this.notifyListeners();

    try {
      if (isNote) {
        const [userNoteBlock, botReply] = await sendNoteBlock(noteId, {
          id: blockId,  // Send UUID to backend
          block: message,
          is_note: isNote
        });

        if (botReply) {
          this.noteBlocks = [...this.noteBlocks, botReply];
          this.notifyListeners();
        }
      } else {
        // Question flow
        const qaBlockId = uuidv4();  // Generate UUID for Q&A block
        const qaBlock = await sendQuestion(noteId, {
          id: qaBlockId,
          question: message,
          parent_note_block_id: parentNoteBlockId
        });
        
        if (qaBlock) {
          this.noteBlocks = [...this.noteBlocks, qaBlock];
          this.notifyListeners();
        }
      }
    } catch (error) {
      console.error('Error sending note block:', error);
      this.noteBlocks = [...this.noteBlocks, {
        sender: 'bot',
        content: 'Error sending note block'
      }];
      this.notifyListeners();
      throw error;
    }
  }

  // Remove handleSendQuestion - merged into sendBlock
  
  getState() {
    return {
      noteBlocks: this.noteBlocks,
      // Remove maxNoteBlockId
    };
  }
}
```

**2. Update [`api.js`](src/frontend/api.js):**

```javascript
export const sendNoteBlock = async (noteId, data) => {
  // data now includes id: UUID string
  const response = await api.post(`coach/notes/${noteId}/note_block`, data);
  return response.data.new_note_blocks;
};

export const sendQuestion = async (noteId, data) => {
  // data now includes id: UUID string
  const response = await api.post(`coach/notes/${noteId}/question`, data);
  return response.data.qa_block;
};
```

**3. Update [`NoteBlock.jsx`](src/frontend/notewindow/NoteBlock.jsx) PropTypes:**

```javascript
NoteBlock.propTypes = {
  block: PropTypes.shape({
    id: PropTypes.string.isRequired,  // Changed from number to string
    sender: PropTypes.string,
    role: PropTypes.string,
    content: PropTypes.string.isRequired,
    question_title: PropTypes.string,
    block_type: PropTypes.string,
    parent_note_block_id: PropTypes.string,  // Changed from number to string
    // ... other props
  }).isRequired,
  // ... other props
};
```

**4. Install uuid package:**

```bash
npm install uuid
```

---

### Phase 2: Data Migration Script

**Duration:** 1 day  
**Risk:** Medium (data transformation)

Create migration script to convert existing numeric IDs to UUIDs:

```python
# src/backend/scripts/migrate_to_uuid.py
import uuid
from sqlmodel import Session, select
from backend.database import engine
from backend.models.note import Note

def generate_deterministic_uuid(note_id: int, block_id: int) -> str:
    """Generate deterministic UUID from numeric IDs for migration."""
    # Use namespace UUID to ensure consistency
    namespace = uuid.UUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')
    return str(uuid.uuid5(namespace, f"note_{note_id}_block_{block_id}"))

def migrate_note_blocks_to_uuid(session: Session):
    """Migrate all note blocks from numeric IDs to UUIDs."""
    notes = session.exec(select(Note)).all()
    
    for note in notes:
        history = note.history or {}
        content = history.get('content', [])
        
        # Create ID mapping for parent references
        id_mapping = {}
        
        # First pass: convert IDs
        for block in content:
            old_id = block.get('id')
            if isinstance(old_id, int):
                new_id = generate_deterministic_uuid(note.id, old_id)
                id_mapping[old_id] = new_id
                block['id'] = new_id
        
        # Second pass: update parent references
        for block in content:
            parent_id = block.get('parent_note_block_id')
            if parent_id and isinstance(parent_id, int):
                block['parent_note_block_id'] = id_mapping.get(parent_id)
        
        # Remove max_message_id
        if 'max_message_id' in note.__dict__:
            delattr(note, 'max_message_id')
        
        session.add(note)
    
    session.commit()
    print(f"Migrated {len(notes)} notes to UUID format")

if __name__ == "__main__":
    with Session(engine) as session:
        migrate_note_blocks_to_uuid(session)
```

**Run migration:**

```bash
# Backup database first!
cp language_coach.db language_coach.db.backup

# Run migration
python -m src.backend.scripts.migrate_to_uuid
```

---

### Phase 3: Remove Legacy Code

**Duration:** 1 day  
**Risk:** Low (cleanup)

1. Remove `max_message_id` column from Note table (requires Alembic migration if using)
2. Remove `get_new_note_block_id()` method
3. Update all tests to use UUIDs
4. Remove `maxNoteBlockId` from frontend state management

---

## Testing Strategy

### Unit Tests

**Backend:**

```python
# src/backend/tests/test_notes_service_uuid.py
import uuid
from backend.services.notes_service import send_note_block
from backend.models.note import NoteBlockCreate

def test_send_note_block_with_uuid(session, sample_note):
    """Test sending note block with frontend-generated UUID."""
    block_id = str(uuid.uuid4())
    
    result = send_note_block(session, sample_note.id, NoteBlockCreate(
        id=block_id,
        block="Test message",
        is_note=True
    ))
    
    assert result['status'] == 'ok'
    assert result['new_note_blocks'][0]['id'] == block_id

def test_question_with_parent_uuid(session, sample_note):
    """Test question linking with UUID parent reference."""
    parent_id = str(uuid.uuid4())
    question_id = str(uuid.uuid4())
    
    # Create parent block first
    send_note_block(session, sample_note.id, NoteBlockCreate(
        id=parent_id,
        block="Parent note",
        is_note=True
    ))
    
    # Send question
    result = send_question(session, sample_note.id, QuestionCreate(
        id=question_id,
        question="What does this mean?",
        parent_note_block_id=parent_id
    ))
    
    assert result['qa_block']['id'] == question_id
    assert result['qa_block']['parent_note_block_id'] == parent_id
```

**Frontend:**

```javascript
// src/frontend/notewindow/__tests__/NoteManager.test.js
import { v4 as uuidv4 } from 'uuid';
import NoteManager from '../NoteManager';

describe('NoteManager with UUIDs', () => {
  it('generates UUID for new blocks', async () => {
    const manager = new NoteManager();
    const noteId = 1;
    
    // Mock API
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ status: 'ok', new_note_blocks: [] })
      })
    );
    
    await manager.sendBlock(noteId, 'Test message', true);
    
    const state = manager.getState();
    expect(state.noteBlocks[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
  
  it('links questions to parent blocks using UUIDs', async () => {
    const manager = new NoteManager();
    const noteId = 1;
    const parentId = uuidv4();
    
    // Add parent block
    manager.noteBlocks = [{
      id: parentId,
      content: 'Parent note',
      is_note: true
    }];
    
    // Mock API
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({
          qa_block: {
            id: uuidv4(),
            parent_note_block_id: parentId,
            question_title: 'Question',
            content: 'Answer'
          }
        })
      })
    );
    
    await manager.sendBlock(noteId, 'What?', false, parentId);
    
    const state = manager.getState();
    const qaBlock = state.noteBlocks.find(b => b.block_type === 'qa_response');
    expect(qaBlock.parent_note_block_id).toBe(parentId);
  });
});
```

### Integration Tests

1. **Create note → Add block → Ask question flow**
   - Verify UUIDs are generated and persisted
   - Verify parent-child relationships work

2. **Load existing note with migrated UUIDs**
   - Verify old data displays correctly
   - Verify new blocks can reference old blocks

3. **Concurrent operations**
   - Multiple users adding blocks simultaneously
   - Verify UUID uniqueness

---

## Rollback Plan

If issues arise during migration:

1. **Restore database backup:**
   ```bash
   cp language_coach.db.backup language_coach.db
   ```

2. **Revert code changes:**
   ```bash
   git revert <migration-commit-hash>
   ```

3. **Redeploy previous version**

---

## Deployment Checklist

- [ ] Review all code changes
- [ ] Run full test suite
- [ ] Backup production database
- [ ] Deploy backend changes
- [ ] Run migration script
- [ ] Verify migration success (spot check notes)
- [ ] Deploy frontend changes
- [ ] Monitor error logs for 24 hours
- [ ] Test create note → question flow in production
- [ ] Document any issues

---

## Benefits After Migration

1. ✅ **First-block problem solved:** Frontend can generate IDs before note creation
2. ✅ **Simpler state management:** No ID synchronization needed
3. ✅ **Better offline support:** Can generate IDs without server
4. ✅ **Distributed-system ready:** UUIDs prevent ID conflicts
5. ✅ **Cleaner code:** Remove `maxNoteBlockId` tracking logic

---

## Estimated Timeline

- **Phase 1 (Add UUID support):** 2 days
- **Phase 2 (Data migration):** 1 day
- **Phase 3 (Cleanup):** 1 day
- **Testing & deployment:** 1 day

**Total:** ~5 days

---

## Questions & Considerations

1. **UUID format:** Using UUID v4 (random) for new blocks, UUID v5 (deterministic) for migration
2. **Ordering:** Use `created_at` timestamp for chronological order since numeric IDs are gone
3. **Performance:** UUID string comparison is slightly slower than int, but negligible for this use case
4. **Storage:** UUIDs take ~36 bytes vs 4-8 bytes for int, but stored in JSON so minimal impact
