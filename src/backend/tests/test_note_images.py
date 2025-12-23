import io
import os
import base64
import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from unittest.mock import patch

from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

from backend.models.note import Note, NoteImage, NoteBlockCreate
from backend.services import notes_service
from backend.services.notes_service import (
    upload_note_image,
    get_note_images,
    delete_note_image,
    get_note_image_file,
    send_note_block,
)

    


@pytest.mark.asyncio
async def test_upload_note_image_success(test_session, temp_directory, monkeypatch):
    # Use a temp upload directory for isolation
    temp_upload_dir = temp_directory / "uploads"
    temp_upload_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(notes_service, "UPLOAD_DIR", temp_upload_dir, raising=False)

    # Create a note
    note = Note(name="Upload Test", history={"content": []})
    test_session.add(note)
    test_session.commit()
    test_session.refresh(note)

    # Minimal PNG file bytes
    png_bytes = (
        b"\x89PNG\r\n\x1a\n"  # header
        b"\x00\x00\x00\rIHDR"  # IHDR chunk start
        b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00"  # 1x1, RGB
        b"\x90wS\xDE"  # CRC (dummy ok for our purposes)
        b"\x00\x00\x00\x0bIDATx\x9cc``\x00\x00\x00\x02\x00\x01"  # IDAT
        b"\x0b\xE7\x02\x9B"  # CRC
        b"\x00\x00\x00\x00IEND\xAEB`\x82"  # IEND
    )
    upload = UploadFile(
        filename="pasted-image.png",
        file=io.BytesIO(png_bytes),
        headers=Headers({"content-type": "image/png"}),
    )

    resp = await upload_note_image(test_session, note.id, upload)

    # Response fields
    assert resp.id is not None
    assert resp.original_filename == "pasted-image.png"
    assert resp.mime_type == "image/png"
    assert resp.file_size == len(png_bytes)

    # DB row exists
    row = test_session.get(NoteImage, resp.id)
    assert row is not None
    assert os.path.exists(row.file_path)

    # Cleanup
    delete_note_image(test_session, note.id, resp.id)
    assert not os.path.exists(row.file_path)


@pytest.mark.asyncio
async def test_upload_note_image_invalid_type(test_session, temp_directory, monkeypatch):
    monkeypatch.setattr(notes_service, "UPLOAD_DIR", temp_directory, raising=False)

    note = Note(name="Bad Type", history={"content": []})
    test_session.add(note)
    test_session.commit()
    test_session.refresh(note)

    upload = UploadFile(
        filename="note.txt",
        file=io.BytesIO(b"hello"),
        headers=Headers({"content-type": "text/plain"}),
    )

    with pytest.raises(HTTPException) as exc:
        await upload_note_image(test_session, note.id, upload)
    assert exc.value.status_code == 400
    assert "Invalid file type" in exc.value.detail


@pytest.mark.asyncio
async def test_upload_note_image_too_large(test_session, temp_directory, monkeypatch):
    monkeypatch.setattr(notes_service, "UPLOAD_DIR", temp_directory, raising=False)
    # Make MAX_FILE_SIZE small to avoid big allocations
    monkeypatch.setattr(notes_service, "MAX_FILE_SIZE", 10, raising=False)

    note = Note(name="Too Large", history={"content": []})
    test_session.add(note)
    test_session.commit()
    test_session.refresh(note)

    upload = UploadFile(
        filename="big.png",
        file=io.BytesIO(b"x" * 20),
        headers=Headers({"content-type": "image/png"}),
    )

    with pytest.raises(HTTPException) as exc:
        await upload_note_image(test_session, note.id, upload)
    assert exc.value.status_code == 400
    assert "File too large" in exc.value.detail


def test_get_note_images_ordering(test_session):
    note = Note(name="List Images", history={"content": []})
    test_session.add(note)
    test_session.commit()
    test_session.refresh(note)

    older = NoteImage(
        note_id=note.id,
        filename="a.png",
        original_filename="a.png",
        file_path="/tmp/a.png",
        mime_type="image/png",
        file_size=1,
        uploaded_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    newer = NoteImage(
        note_id=note.id,
        filename="b.png",
        original_filename="b.png",
        file_path="/tmp/b.png",
        mime_type="image/png",
        file_size=1,
        uploaded_at=datetime.now(timezone.utc),
    )
    test_session.add(older)
    test_session.add(newer)
    test_session.commit()

    items = get_note_images(test_session, note.id)
    assert [i.original_filename for i in items] == ["b.png", "a.png"]


def test_get_note_image_file_returns_fileresponse(test_session, temp_directory):
    note = Note(name="File Serve", history={"content": []})
    test_session.add(note)
    test_session.commit()
    test_session.refresh(note)

    img_path = temp_directory / "img.png"
    img_path.write_bytes(b"PNGDATA")

    image = NoteImage(
        note_id=note.id,
        filename="img.png",
        original_filename="img.png",
        file_path=str(img_path),
        mime_type="image/png",
        file_size=7,
    )
    test_session.add(image)
    test_session.commit()
    test_session.refresh(image)

    resp = get_note_image_file(test_session, note.id, image.id)
    # Verify basic attributes
    assert resp.path == str(img_path)
    assert resp.media_type == "image/png"


@patch("backend.services.notes_service.client")
def test_send_note_block_with_image_refs_embeds_and_keeps_original(mock_client, test_session, temp_directory):
    # Prepare note and image on disk
    note = Note(name="Image Note", history={"content": []})
    test_session.add(note)
    test_session.commit()
    test_session.refresh(note)

    # Create a real small file for base64
    img_bytes = b"abc123"
    img_path = temp_directory / "upl.png"
    img_path.write_bytes(img_bytes)

    image = NoteImage(
        note_id=note.id,
        filename="upl.png",
        original_filename="upl.png",
        file_path=str(img_path),
        mime_type="image/png",
        file_size=len(img_bytes),
    )
    test_session.add(image)
    test_session.commit()
    test_session.refresh(image)

    # Mock streaming response
    class MockChunk:
        def __init__(self, content):
            self.choices = [type("obj", (object,), {
                "delta": type("obj", (object,), {"content": content})()
            })()]

    mock_client.chat.completions.create.return_value = [MockChunk("OK")] 

    msg = NoteBlockCreate(block=f"Here is an image @image:{image.id}")
    result = send_note_block(test_session, note.id, msg)

    # Verify OpenAI call contains image_url with data: URL
    mock_client.chat.completions.create.assert_called_once()
    called_kwargs = mock_client.chat.completions.create.call_args[1]
    assert called_kwargs["stream"] is True

    # Inspect the last user message payload
    messages = called_kwargs["messages"]
    last = messages[-1]
    assert last["role"] == "user"
    # First item is text, followed by image_url
    assert isinstance(last["content"], list)
    types = [part.get("type") for part in last["content"]]
    assert types[0] == "text"
    assert "image_url" in last["content"][1]
    url = last["content"][1]["image_url"]["url"]
    assert url.startswith("data:image/png;base64,")
    assert url.endswith(base64.b64encode(img_bytes).decode())

    # History keeps the original message with @image:id
    updated = test_session.get(Note, note.id)
    assert updated.history["content"][0]["content"] == msg.block