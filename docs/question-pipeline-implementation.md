# Question Pipeline Implementation - Technical Assignment

## Overview

This document describes the implementation of the new question pipeline that sends only one block instead of two, links questions to notes via parent relationships, and processes questions in the context of the note.

## Requirements

### Frontend Changes

1. **Single Block Response for Questions**
   - Questions should return ONE structured Q&A block (not two separate blocks)
   - The block contains both the rephrased question (title) and the answer

2. **Parent Note Relationship**
   - Questions are linked to specific note blocks via `parent_note_block_id`
   - This allows grouping questions with their context

3. **New Question Flow**
   - Replace `sendNoteBlock` with `sendQuestion` for questions (when `isNote=false`)
   - Remove the old two-block behavior

### Backend Changes

1. **Question Processing with Context**
   - Questions are asked in the context of the parent note
   - System prompt + question + note context → OpenAI
   - Response format:
     - First line: Rephrased question (used as title)
     - Remaining lines: Answer

2. **Structured Content Storage**
   - Store Q&A as structured JSON: `{title: string, answer: string}`
   - Add `block_type: "qa_response"` to identify Q&A blocks
   - Add `parent_note_block_id` to link to parent note block

3. **Dynamic Image IDs**
   - Parse `@image:X` references from content dynamically
   - No need to store `image_ids` separately
   - Use computed field in model

## Implementation Details

### Backend Architecture

#### 1. Models (`src/backend/models/note.py`)

**NoteBlock Model Updates:**
```python
class NoteBlock(BaseModel):
    content: Union[str, dict]  # Support both string and structured content
    parent_note_block_id: Optional[int] = None  # Link to parent block
    block_type: Optional[str] = None  # "qa_response" for Q&A blocks
    
    @computed_field
    @property
    def image_ids(self) -> List[int]:
        """Dynamically parse @image:X references from content"""
        # Implementation parses content for @image:(\d+) pattern
```

**New QuestionCreate Model:**
```python
class QuestionCreate(BaseModel):
    question: str
    parent_note_block_id: Optional[int] = None
```

#### 2. API Endpoint (`src/backend/api/notes.py`)

**New Question Endpoint:**
```python
@router.post('/{id}/question')
def send_question_endpoint(
    session: SessionDep,
    id: int,
    question_data: QuestionCreate
) -> dict:
    """
    Send a question about a note
    Returns: {"qa_block": NoteBlock}
    """
    return send_question(session, id, question_data)
```

#### 3. Service Layer

**QuestionService (`src/backend/services/question_service.py`):**

Main orchestrator class with the following responsibilities:

- **Process Question Flow:**
  1. Get note and validate
  2. Process images in question content (via ImageProcessor)
  3. Get parent note block context if specified
  4. Build prompt messages with system prompt, note history, question, and formatting instruction
  5. Call OpenAI (via OpenAIProvider)
  6. Parse response into title and answer
  7. Create Q&A block with structured content
  8. Save to note history

- **Private Helper Methods:**
  - `_get_note()`: Fetch and validate note
  - `_get_note_block()`: Fetch parent note block
  - `_build_prompt_messages()`: Construct OpenAI messages array
  - `_parse_qa_response()`: Parse AI response into title/answer
  - `_create_qa_block()`: Create structured Q&A note block
  - `_save_note_block()`: Persist block to database

**OpenAIProvider (`src/backend/services/question/openai_provider.py`):**

Encapsulates OpenAI API communication:
```python
class OpenAIProvider:
    def generate_response(self, messages: List[dict]) -> str:
        """Stream OpenAI response and accumulate full text"""
```

**ImageProcessor (`src/backend/services/question/image_processor.py`):**

Handles image references in questions:
```python
class ImageProcessor:
    @staticmethod
    def process_images(content: str, note_id: int) -> ProcessedContent:
        """
        Parse @image:X references and prepare image contents for OpenAI
        Returns: ProcessedContent(text, image_contents)
        """
```

**Notes Service (`src/backend/services/notes_service.py`):**

Added delegation method:
```python
def send_question(
    session: Session,
    note_id: int,
    question_data: QuestionCreate
) -> dict:
    """Delegate to QuestionService"""
    service = QuestionService(session)
    return service.process_question(note_id, question_data)
```

### Frontend Architecture

#### 1. API Client (`src/frontend/api.js`)

**New sendQuestion Function:**
```javascript
export const sendQuestion = async (noteId, data) => {
  const response = await api.post(`coach/notes/${noteId}/question`, data);
  return response.data.qa_block;
};
```

#### 2. NoteManager (`src/frontend/notewindow/NoteManager.js`)

**Updated sendBlock Method:**
```javascript
async sendBlock(noteId, message, isNote = false, parentNoteBlockId = null) {
  // Add optimistic user block ONLY for notes
  if (isNote) {
    // Add user block to UI
    // Call sendNoteBlock
  } else {
    // NEW: Question flow - returns SINGLE Q&A block
    const qaBlock = await sendQuestion(noteId, {
      question: message,
      parent_note_block_id: parentNoteBlockId
    });
    
    if (qaBlock) {
      this.noteBlocks = [...this.noteBlocks, qaBlock];
      this.notifyListeners();
    }
  }
}
```

**Removed:**
- `handleSendQuestion()` method (old two-block behavior)

#### 3. NoteBlock Component (`src/frontend/notewindow/NoteBlock.jsx`)

**Q&A Rendering:**
```javascript
// Detect Q&A blocks
const isQABlock = block.block_type === 'qa_response' && typeof block.content === 'object';

// Render structured Q&A content
{isQABlock && currentContent.type === 'note' ? (
  <div className="qa-block">
    <h3 className="qa-title">{block.content.title}</h3>
    <div className="qa-answer">
      <MarkdownContent content={block.content.answer} noteId={noteId} />
    </div>
  </div>
) : (
  <TranslatableContent ... />
)}
```

**PropTypes Update:**
```javascript
block: PropTypes.shape({
  content: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
  block_type: PropTypes.string,
  // ...
})
```

#### 4. Styling (`src/frontend/notewindow/NoteBlock.css`)

**Q&A Block Styles:**
```css
.qa-block {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.qa-title {
    margin: 0;
    padding: 0.75rem 1rem;
    background-color: #f0f7ff;
    border-left: 4px solid #387ef7;
    border-radius: 6px;
    font-size: 1.05rem;
    font-weight: 600;
    color: #1a1a1a;
    line-height: 1.4;
}

.qa-answer {
    padding: 0.5rem 0;
    color: #2c3e50;
    line-height: 1.6;
}
```

## Data Flow

### Question Submission Flow

1. **User submits question** in UI with optional parent note block ID
2. **Frontend (NoteManager)** calls `sendQuestion(noteId, {question, parent_note_block_id})`
3. **API endpoint** receives request at `POST /api/coach/notes/{id}/question`
4. **QuestionService** orchestrates:
   - Fetches note and parent block context
   - Processes images in question
   - Builds prompt with system prompt, note history (only `is_note=true` blocks), question, and context
   - Calls OpenAI via OpenAIProvider
   - Parses response: first line = title, rest = answer
   - Creates structured block: `{content: {title, answer}, block_type: "qa_response", parent_note_block_id, is_note: false}`
   - Saves to database
5. **API returns** `{qa_block: NoteBlock}`
6. **Frontend** appends single Q&A block to UI
7. **NoteBlock component** detects `block_type === "qa_response"` and renders with special Q&A styling

### Note Submission Flow (Unchanged)

1. User submits note (`isNote=true`)
2. Frontend adds optimistic user block to UI
3. Calls `sendNoteBlock(noteId, {block, is_note: true})`
4. Backend saves user block, returns `[userBlock]`
5. Frontend already has optimistic block, no additional UI update needed

## Key Differences from Old Behavior

| Aspect | Old Behavior | New Behavior |
|--------|-------------|--------------|
| **Question Response** | 2 blocks (user + bot) | 1 structured Q&A block |
| **Content Format** | String only | String or structured object |
| **Parent Relationship** | None | `parent_note_block_id` links to context |
| **Block Type** | Generic | `block_type: "qa_response"` for Q&A |
| **Image IDs** | Stored in field | Computed dynamically from content |
| **API Endpoint** | `POST /notes/{id}/block` with `is_note=false` | `POST /notes/{id}/question` |
| **Frontend Method** | `sendNoteBlock` for both | `sendQuestion` for questions, `sendNoteBlock` for notes |
| **Optimistic UI** | Added for both | Only for notes, not questions |

## Testing Considerations

### Backend Tests

1. **QuestionService Tests:**
   - Test prompt building with note context
   - Test response parsing (title extraction)
   - Test structured content creation
   - Test parent_note_block_id linking
   - Test image processing integration

2. **API Endpoint Tests:**
   - Test question submission returns single qa_block
   - Test parent_note_block_id is preserved
   - Test structured content format
   - Test error handling

3. **Model Tests:**
   - Test NoteBlock with structured content
   - Test computed image_ids field
   - Test parent_note_block_id relationship

### Frontend Tests

1. **NoteManager Tests:**
   - Test sendBlock with isNote=false calls sendQuestion
   - Test sendBlock with isNote=true calls sendNoteBlock
   - Test parentNoteBlockId is passed correctly
   - Test single block is added for questions

2. **NoteBlock Component Tests:**
   - Test Q&A block rendering with structured content
   - Test regular content rendering
   - Test block_type detection
   - Test editing Q&A blocks (JSON format)

3. **Integration Tests:**
   - Test full question flow from UI to backend and back
   - Test parent relationship is maintained
   - Test Q&A styling is applied

## Migration Notes

### Database Schema

**New Fields (Optional, backward compatible):**
- `note_blocks.parent_note_block_id` (nullable integer, foreign key to note_blocks.id)
- `note_blocks.block_type` (nullable string)

**Existing Fields:**
- `note_blocks.content` now supports JSON (already JSONB in PostgreSQL)
- `note_blocks.image_ids` can be removed if fully relying on computed field (optional cleanup)

### Backward Compatibility

- Existing note blocks with string content continue to work
- New Q&A blocks use structured content
- `parent_note_block_id` and `block_type` are optional fields
- Frontend handles both string and object content types

## Future Enhancements

1. **Question Threading:**
   - Display questions grouped under their parent note blocks
   - Collapsible question sections

2. **Question Search:**
   - Search across question titles
   - Filter by parent note

3. **Question Analytics:**
   - Track most asked question types
   - Identify knowledge gaps

4. **Enhanced Context:**
   - Include multiple parent blocks
   - Include related notes

5. **Question Templates:**
   - Pre-defined question formats
   - Quick question buttons

## Files Modified

### Backend
- `src/backend/models/note.py` - Updated NoteBlock model, added QuestionCreate
- `src/backend/api/notes.py` - Added question endpoint
- `src/backend/services/notes_service.py` - Added send_question function
- `src/backend/services/question_service.py` - New QuestionService class
- `src/backend/services/question/openai_provider.py` - New OpenAIProvider class
- `src/backend/services/question/image_processor.py` - New ImageProcessor class
- `src/backend/services/question/__init__.py` - Package initialization

### Frontend
- `src/frontend/api.js` - Added sendQuestion function
- `src/frontend/notewindow/NoteManager.js` - Updated sendBlock, removed handleSendQuestion
- `src/frontend/notewindow/NoteBlock.jsx` - Added Q&A rendering, updated PropTypes
- `src/frontend/notewindow/NoteBlock.css` - Added Q&A styling

### Documentation
- `plans/question-pipeline-refactor.md` - Initial specification
- `plans/question-pipeline-oop-design.md` - OOP design document
- `docs/question-pipeline-implementation.md` - This document

## Summary

The new question pipeline provides a cleaner, more structured approach to handling questions:

- **Single block response** reduces UI complexity and improves UX
- **Parent relationships** enable context-aware questions and future threading features
- **Structured content** allows rich rendering and better data management
- **OOP architecture** improves maintainability with clear separation of concerns
- **Dynamic image parsing** eliminates redundant storage

The implementation maintains backward compatibility while providing a foundation for future enhancements.
