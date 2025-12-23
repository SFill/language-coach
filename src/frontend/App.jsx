import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router'; // Keep using 'react-router' if that's what's available
import NoteListPage from './NoteListPage';
import NoteWindowPage from './notewindow/NoteWindowPage';
import WordListPage from './wordlist/WordListPage';
import { fetchNotes, deleteNote } from './api';
import WordlistProvider from './wordlist/WordlistContext';
import LanguagePicker from './LanguagePicker';
import './App.css';

// Main App component to set up routes
function App() {
  return (
    <Router>
      <WordlistProvider>
        <AppContent />
      </WordlistProvider>

    </Router>
  );
}

// Content component that has access to router hooks
function AppContent() {
  const [noteList, setNoteList] = useState([]);
  const [currentNoteName, setCurrentNoteName] = useState(null);
  const [currentNoteId, setCurrentNoteId] = useState(null);
  const navigate = useNavigate(); // React Router's navigate function
  const location = useLocation(); // Get current location

  useEffect(() => {
    // load once for navbar mount, refresh when changes
    loadNotes();
    console.log("loadNotes() init")
  }, [])

  // Extract noteId from location pathname instead of using useParams
  useEffect(() => {
    console.log("currentNoteId " + currentNoteId)
    if (location.pathname.match(/\/note\/(\d+)/) || location.pathname === '/') {
      // Extract noteId from location pathname using regex
      const match = location.pathname.match(/\/note\/(\d+)/);
      const noteIdFromPath = match ? parseInt(match[1]) : null;
      // set it, null if it's a default page
      if (noteIdFromPath !== currentNoteId) {
        setCurrentNoteId(noteIdFromPath);
      }
    }
    console.log("[location.pathname])")
  }, [location.pathname]);

  // Handle selection when noteList changes
  useEffect(() => {
    let foundNoteName = null;
    if (noteList.length > 0 && currentNoteId) {
      const currentNote = noteList.find(note => note.id === currentNoteId);

      if (currentNote) {
        foundNoteName = currentNote.name
      }
    }
    setCurrentNoteName(foundNoteName)
    console.log("[noteList, currentNoteId])")
  }, [noteList, currentNoteId]);

  const loadNotes = async () => {
    const notes = await fetchNotes();
    setNoteList(notes);
  };

  const handleNoteSelect = (noteId) => {
    setCurrentNoteId(noteId);
    // Navigate without page reload
    navigate(`/note/${noteId}`);
  };

  const onDeleteNote = async (noteId) => {
    if (!noteId) return;
    await deleteNote(noteId);
    const updatedNotes = noteList.filter(note => note.id !== noteId);
    setNoteList(updatedNotes);
    if (currentNoteId === noteId) {
      setCurrentNoteId(null);
      // Navigate to note list if we deleted the current note
      navigate('/notelist');
    }
  };

  // Function to handle note name click
  const handleNoteNameClick = () => {
    const path = location.pathname;
    // Check if we're already on a note page
    if (path === '/' || path.startsWith('/note/')) {
      // If on home or note page, go to note list
      navigate('/notelist');
    } else {
      // If we have a current note ID, go to that note
      if (currentNoteId) {
        navigate(`/note/${currentNoteId}`);
      } else {
        // Otherwise go to home page
        navigate('/');
      }
    }
  };

  // This function will be passed to NoteWindowPage to notify when a new note is created
  const onNoteCreated = (newNoteId, message) => {
    loadNotes(); // Reload the note list to include the new note
    setCurrentNoteId(newNoteId); // Update the current note ID
    // Pass message as state in navigation
    navigate(`/note/${newNoteId}`, {
      state: { initialMessage: message, },
      replace: true
    });
  };

  return (
    <div className="main-container">
      <nav className="navbar">
        <h3 onClick={handleNoteNameClick} style={{ cursor: 'pointer', color: 'inherit' }}>
          {currentNoteName || "Select Note"}
        </h3>
        <div className="nav-links">
          <Link to="/">New note</Link>
          <Link to="/wordlist">My words</Link>
        </div>
        <div className="nav-controls">
          <LanguagePicker />
        </div>
      </nav>
      <div className="main-block">
        <Routes>
          {/* Root path directly shows NoteWindowPage, no redirection */}
          <Route
            path="/"
            element={<NoteWindowPage key={location.pathname} onNoteCreated={onNoteCreated} />}
          />

          {/* Individual note route with path parameter */}
          <Route
            path="/note/:noteId"
            element={<NoteWindowPage onNoteCreated={onNoteCreated} />}
          />

          <Route path="/wordlist" element={<WordListPage />} />
          <Route
            path="/notelist"
            element={
              <NoteListPage
                noteList={noteList}
                currentNoteId={currentNoteId}
                loadNote={handleNoteSelect}
                deleteNote={onDeleteNote}
              />
            }
          />
        </Routes>
      </div>
    </div>
  );
}

export default App;