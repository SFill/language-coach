import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router';
import NoteListPage from './NoteListPage';
import NoteWindowPage from './notewindow/NoteWindowPage';
import WordListPage from './wordlist/WordListPage';
import WordlistProvider from './wordlist/WordlistContext';
import LanguagePicker from './LanguagePicker';
import NoteListManager from './notewindow/NoteListManager';
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
  const [noteManager, setNoteManager] = useState(null);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Create NoteListManager instance
  const noteListManager = useMemo(() => {
    const manager = new NoteListManager();
    manager.setNavigateCallback((path, options) => navigate(path, options));
    manager.subscribe((state) => {
      console.log(state)
      setNoteList(state.noteList);
      setCurrentNoteId(state.currentNoteId);
      setCurrentNoteName(state.currentNoteName);
      setNoteManager(state.noteManager);
    });
    return manager;
  }, []);

  // Load notes on mount
  useEffect(() => {
    noteListManager.loadNotes();
    console.log("loadNotes() init");
  }, []);

  // Update current note from URL path
  useEffect(() => {
    noteListManager.setCurrentNoteFromPath(location.pathname, location.state);
    console.log("[location.pathname])");
  }, [location.pathname, noteListManager]);

  return (
    <div className="main-container">
      <nav className="navbar">
        <h3
          onClick={() => noteListManager.handleNoteNameClick(location.pathname)}
          style={{ cursor: 'pointer', color: 'inherit' }}
        >
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
            element={<NoteWindowPage key={location.pathname} noteManager={noteManager} />}
          />

          {/* Individual note route with path parameter */}
          <Route
            path="/note/:noteId"
            element={<NoteWindowPage noteManager={noteManager} />}
          />

          <Route path="/wordlist" element={<WordListPage />} />
          <Route
            path="/notelist"
            element={
              <NoteListPage
                noteList={noteList}
                currentNoteId={currentNoteId}
                loadNote={(noteId) => noteListManager.selectNote(noteId)}
                deleteNote={(noteId) => noteListManager.deleteNote(noteId)}
              />
            }
          />
        </Routes>
      </div>
    </div>
  );
}

export default App;