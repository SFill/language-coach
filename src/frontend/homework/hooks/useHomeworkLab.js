import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  fetchAssignments,
  fetchNoteById,
  sendNoteBlock,
  updateNoteBlock,
  analyzeDraft,
  getNoteImageUrl,
  sendQuestion as apiSendQuestion,
} from '../../api';

function generateUUID() {
  return crypto.randomUUID();
}

export function useHomeworkLab() {
  const { noteId } = useParams();
  const navigate = useNavigate();

  const [notes, setNotes] = useState([]);          // all notes with assignment blocks (for /homework list)
  const [activeNote, setActiveNote] = useState(null); // full note detail (for /homework/:noteId)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch notes that contain assignment blocks (for the card list when no note is selected)
  useEffect(() => {
    fetchAssignments()
      .then((data) => setNotes(data || []))
      .catch((err) => setError(err.message));
  }, []);

  // Fetch note detail when noteId changes
  useEffect(() => {
    if (!noteId) {
      setActiveNote(null);
      return;
    }

    setLoading(true);
    fetchNoteById(noteId)
      .then((data) => {
        setActiveNote(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [noteId]);

  const selectNote = useCallback((id) => {
    navigate(`/homework/${id}`);
  }, [navigate]);

  // Submit/update draft — uses PATCH for idempotent upsert
  // If draft block exists, update it; if not, create it with a client-generated UUID
  const submitDraft = useCallback(async (noteId, text, blockId, assignmentRef) => {
    if (!noteId || !text?.trim()) return null;
    const id = blockId || generateUUID();
    try {
      await updateNoteBlock(noteId, id, {
        block: text,
        role: 'user',
        block_type: 'simple_note',
        assignment_ref: assignmentRef || undefined,
      });
      const updated = await fetchNoteById(noteId);
      if (updated) setActiveNote(updated);
      return { status: 'ok', blockId: id };
    } catch (err) {
      console.error('Error submitting draft:', err);
      return null;
    }
  }, []);

  // Run AI Check on a draft block
  const runAICheck = useCallback(async (id, blockId) => {
    if (!id || !blockId) return null;
    try {
      const result = await analyzeDraft(id, blockId);
      const updated = await fetchNoteById(id);
      if (updated) setActiveNote(updated);
      return result;
    } catch (err) {
      console.error('Error running AI Check:', err);
      return null;
    }
  }, []);

  // Send a Q&A question
  const sendQuestion = useCallback(async (id, question, assignmentRef) => {
    if (!id || !question?.trim()) return null;
    try {
      const qaBlock = await apiSendQuestion(id, { question, assignment_ref: assignmentRef });
      const updated = await fetchNoteById(id);
      if (updated) setActiveNote(updated);
      return qaBlock;
    } catch (err) {
      console.error('Error sending question:', err);
      return null;
    }
  }, []);

  // Map a note to a card for the /homework list (shows one card per note)
  const mapNoteToCard = useCallback((note) => {
    const assignmentBlock = (note.note_blocks || []).find(
      (b) => b.block_type === 'assignment'
    );
    let imageUrl = null;
    if (assignmentBlock?.image_ids?.length) {
      imageUrl = getNoteImageUrl(note.id, assignmentBlock.image_ids[0]);
    }
    const meta = assignmentBlock?.metadata_ || {};

    return {
      id: String(note.id),
      image: imageUrl,
      category: meta.category || '',
      categoryColor: meta.categoryColor || 'primary',
      duration: meta.duration || 0,
      description: meta.description || '',
      targetLength: meta.targetLength || '',
      difficulty: meta.difficulty || '',
    };
  }, []);

  // Cards when no note is selected: one card per note
  const noteCards = notes.map(mapNoteToCard);

  // Cards when a note is selected: one card per assignment block in that note
  const assignmentCards = (activeNote?.note_blocks || [])
    .filter((b) => b.block_type === 'assignment')
    .map((block) => {
      let imageUrl = null;
      if (block.image_ids?.length) {
        imageUrl = getNoteImageUrl(activeNote.id, block.image_ids[0]);
      }
      const meta = block.metadata_ || {};

      return {
        id: String(activeNote.id),
        blockId: String(block.id),
        image: imageUrl,
        category: meta.category || '',
        categoryColor: meta.categoryColor || 'primary',
        duration: meta.duration || 0,
        description: meta.description || '',
        targetLength: meta.targetLength || '',
        difficulty: meta.difficulty || '',
      };
    });

  // Final card list: per-note when on /homework, per-block when on /homework/:noteId
  const cards = noteId ? assignmentCards : noteCards;

  return {
    cards,
    noteId,
    activeNote,
    selectNote,
    submitDraft,
    runAICheck,
    sendQuestion,
    loading,
    error,
  };
}