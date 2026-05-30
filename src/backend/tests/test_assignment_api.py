"""Tests for the homework/assignment API extensions."""

import pytest
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

from backend.models.note import (
    Note,
    NoteBlock,
    NoteBlockCreate,
    NoteCreate,
    NoteListResponse,
    DraftSegment,
    AnalyzeResponse,
)
from backend.services.notes_service import (
    create_note,
    get_note_list,
    get_note,
    send_note_block,
)


@pytest.fixture
def engine():
    """Create a test database engine with in-memory SQLite."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture
def session(engine):
    """Create a test database session."""
    with Session(engine) as session:
        yield session


# --- NoteCreate schema tests ---

class TestNoteCreate:
    def test_note_create_defaults(self):
        data = NoteCreate(name="Test")
        assert data.name == "Test"
        assert data.note_metadata is None
        assert data.history == {"content": []}

    def test_note_create_with_metadata(self):
        data = NoteCreate(
            name="Parisian Cafe",
            note_metadata={
                "category": "Grammar: Past Tense",
                "categoryColor": "tertiary",
                "duration": 15,
                "targetLength": "150-200 words",
                "difficulty": "B2",
            },
        )
        assert data.note_metadata["difficulty"] == "B2"


# --- Note model tests ---

class TestNoteModel:
    def test_note_default_fields(self, session):
        note = Note(name="Regular Note")
        session.add(note)
        session.commit()
        session.refresh(note)
        assert note.metadata_ is None

    def test_note_with_metadata(self, session):
        note = Note(
            name="Parisian Cafe",
            metadata_={
                "category": "Grammar: Past Tense",
                "difficulty": "B2",
            },
        )
        session.add(note)
        session.commit()
        session.refresh(note)
        assert note.metadata_["difficulty"] == "B2"

    def test_note_metadata_computed_field(self, session):
        note = Note(name="Test", metadata_={"key": "value"})
        assert note.note_metadata == {"key": "value"}

    def test_note_metadata_computed_field_none(self, session):
        note = Note(name="Test")
        assert note.note_metadata == {}

    def test_note_model_dump_excludes_metadata_underscore(self, session):
        note = Note(name="Test", metadata_={"key": "value"})
        session.add(note)
        session.commit()
        session.refresh(note)
        dumped = note.model_dump()
        assert "metadata_" not in dumped
        assert "history" not in dumped
        assert "note_metadata" in dumped
        assert dumped["note_metadata"] == {"key": "value"}


# --- NoteBlock Union content tests ---

class TestNoteBlockContent:
    def test_note_block_string_content(self):
        block = NoteBlock(id="550e8400-e29b-41d4-a716-446655440000", role="user", content="Hello world")
        assert block.content == "Hello world"
        assert block.image_ids == []

    def test_note_block_list_content(self):
        segments = [
            {"text": "The morning air was ", "type": "plain"},
            {"text": "vibrant", "type": "vocab", "word": "vibrant", "phonetic": "/ˈvaɪbrənt/", "annotation": "Full of energy."},
            {"text": " red awnings.", "type": "plain"},
        ]
        block = NoteBlock(id="550e8400-e29b-41d4-a716-446655440001", role="assistant", content=segments)
        assert isinstance(block.content, list)
        assert len(block.content) == 3
        assert block.content[1]["type"] == "vocab"

    def test_note_block_list_content_image_ids_empty(self):
        """Segmented content should not have @image: references."""
        segments = [{"text": "Hello", "type": "plain"}]
        block = NoteBlock(id="550e8400-e29b-41d4-a716-446655440002", role="user", content=segments)
        assert block.image_ids == []

    def test_note_block_string_content_image_ids(self):
        block = NoteBlock(id="550e8400-e29b-41d4-a716-446655440003", role="user", content="See @image:3 and @image:7")
        assert block.image_ids == [3, 7]

    def test_note_block_metadata_field(self):
        block = NoteBlock(
            id="550e8400-e29b-41d4-a716-446655440004", role="user", content="Test",
            block_type="assignment",
            metadata_={"category": "Grammar", "difficulty": "B2"},
        )
        assert block.block_type == "assignment"
        assert block.metadata_["difficulty"] == "B2"

    def test_note_block_assignment_ref(self):
        block = NoteBlock(
            id="550e8400-e29b-41d4-a716-446655440005", role="user", content="Test",
            assignment_ref="550e8400-e29b-41d4-a716-446655440099",
        )
        assert block.assignment_ref == "550e8400-e29b-41d4-a716-446655440099"


# --- NoteListResponse enrichment tests ---

class TestNoteListResponse:
    def test_list_response_includes_metadata_and_blocks(self, session):
        note = Note(
            name="Assignment",
            metadata_={"difficulty": "B2", "category": "Grammar"},
        )
        session.add(note)
        session.commit()

        result = get_note_list(session)
        assert len(result) == 1
        assert result[0].note_metadata == {"difficulty": "B2", "category": "Grammar"}

    def test_list_response_filters_by_block_type(self, session):
        note1 = Note(name="Regular Note", history={"content": []})
        note2 = Note(name="Assignment Note", history={"content": [
            {"id": "550e8400-e29b-41d4-a716-446655440010", "role": "user", "content": "Write about a cafe", "block_type": "assignment", "metadata_": {"category": "Grammar"}}
        ]})
        session.add(note1)
        session.add(note2)
        session.commit()

        all_notes = get_note_list(session)
        assert len(all_notes) == 2

        assignments = get_note_list(session, block_type="assignment")
        assert len(assignments) == 1
        assert assignments[0].name == "Assignment Note"

        regular = get_note_list(session, block_type="simple_note")
        assert len(regular) == 0


# --- DraftSegment and AnalyzeResponse tests ---

class TestDraftSegment:
    def test_plain_segment(self):
        seg = DraftSegment(text="Hello", type="plain")
        assert seg.text == "Hello"
        assert seg.type == "plain"
        assert seg.word is None
        assert seg.phonetic is None
        assert seg.annotation is None

    def test_vocab_segment(self):
        seg = DraftSegment(
            text="vibrant",
            type="vocab",
            word="vibrant",
            phonetic="/ˈvaɪbrənt/",
            annotation="Full of energy.",
        )
        assert seg.word == "vibrant"
        assert seg.phonetic == "/ˈvaɪbrənt/"

    def test_suggestion_segment(self):
        seg = DraftSegment(
            text="had went",
            type="suggestion",
            annotation="Correct: had gone",
        )
        assert seg.type == "suggestion"
        assert seg.annotation == "Correct: had gone"


class TestAnalyzeResponse:
    def test_analyze_response(self):
        segments = [
            DraftSegment(text="Hello ", type="plain"),
            DraftSegment(text="vibrant", type="vocab", word="vibrant", phonetic="/ˈvaɪbrənt/", annotation="Full of energy."),
        ]
        response = AnalyzeResponse(
            status="ok",
            segments=segments,
            feedback_block={"id": "550e8400-e29b-41d4-a716-446655440020", "role": "assistant", "content": []},
        )
        assert response.status == "ok"
        assert len(response.segments) == 2
        assert response.segments[1].type == "vocab"


# --- NoteBlockCreate block_type tests ---

class TestNoteBlockCreate:
    def test_default_block_type_is_none(self):
        data = NoteBlockCreate(block="Hello")
        assert data.block_type is None

    def test_assignment_block_type(self):
        data = NoteBlockCreate(block="Write about a cafe", block_type="assignment")
        assert data.block_type == "assignment"

    def test_simple_note_block_type(self):
        data = NoteBlockCreate(block="I sat at the cafe", block_type="simple_note")
        assert data.block_type == "simple_note"

    def test_block_metadata_field(self):
        data = NoteBlockCreate(
            block="Write about a cafe",
            block_type="assignment",
            metadata_={"category": "Grammar", "difficulty": "B2"},
        )
        assert data.metadata_["difficulty"] == "B2"

    def test_block_assignment_ref(self):
        data = NoteBlockCreate(
            block="My draft text",
            block_type="simple_note",
            assignment_ref="550e8400-e29b-41d4-a716-446655440099",
        )
        assert data.assignment_ref == "550e8400-e29b-41d4-a716-446655440099"


# --- send_note_block block_type routing tests ---

class TestSendNoteBlockRouting:
    """Test that block_type controls AI invocation."""

    def test_assignment_skips_ai(self, session):
        """Blocks with block_type='assignment' should NOT call AI."""
        note = Note(name="Test", history={"content": []})
        session.add(note)
        session.commit()
        session.refresh(note)

        result = send_note_block(session, note.id, NoteBlockCreate(
            block="Describe the cafe",
            block_type="assignment",
        ))
        # Should return only the user block, no assistant block
        assert len(result["new_note_blocks"]) == 1
        assert result["new_note_blocks"][0]["block_type"] == "assignment"

    def test_ai_feedback_skips_ai(self, session):
        """Blocks with block_type='ai_feedback' should NOT call AI."""
        note = Note(name="Test", history={"content": []})
        session.add(note)
        session.commit()
        session.refresh(note)

        result = send_note_block(session, note.id, NoteBlockCreate(
            block="AI analysis result",
            block_type="ai_feedback",
        ))
        # Should return only the user block, no assistant block
        assert len(result["new_note_blocks"]) == 1
        assert result["new_note_blocks"][0]["block_type"] == "ai_feedback"

    def test_simple_note_skips_ai(self, session):
        """Blocks with block_type='simple_note' should NOT call AI."""
        note = Note(name="Test", history={"content": []})
        session.add(note)
        session.commit()
        session.refresh(note)

        result = send_note_block(session, note.id, NoteBlockCreate(
            block="My note about the lesson",
            block_type="simple_note",
        ))
        assert len(result["new_note_blocks"]) == 1
        assert result["new_note_blocks"][0]["block_type"] == "simple_note"

    def test_note_block_type_preserved(self, session):
        """block_type should be stored in the NoteBlock."""
        note = Note(name="Test", history={"content": []})
        session.add(note)
        session.commit()
        session.refresh(note)

        result = send_note_block(session, note.id, NoteBlockCreate(
            block="My draft text",
            block_type="simple_note",
        ))
        assert result["new_note_blocks"][0]["block_type"] == "simple_note"