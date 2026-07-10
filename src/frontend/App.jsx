import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router';
import NoteListPage from './NoteListPage';
import NoteWindowPage from './notewindow/NoteWindowPage';
import WordListPage from './wordlist/WordListPage';
import WordlistProvider from './wordlist/WordlistContext';
import NoteListManager from './notewindow/NoteListManager';
import HomeworkLab from './homework/HomeworkLab';
import HomeworkListStore from './homework/HomeworkListStore';
import TopNavBar from './homework/components/TopNavBar';
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
      console.log(state);
      setNoteList(state.noteList);
      setCurrentNoteId(state.currentNoteId);
      setCurrentNoteName(state.currentNoteName);
      setNoteManager(state.noteManager);
    });
    return manager;
  }, []);

  // Create HomeworkListStore instance (singleton, sibling of noteListManager)
  const homeworkStore = useMemo(() => new HomeworkListStore(), []);

  // Load notes on mount
  useEffect(() => {
    noteListManager.loadNotes();
    console.log('loadNotes() init');
  }, []);

  // Update current note from URL path
  useEffect(() => {
    noteListManager.setCurrentNoteFromPath(location.pathname, location.state);
    console.log('[location.pathname])');
  }, [location.pathname, noteListManager]);

  // Wire HomeworkListStore navigate callback + initial load
  useEffect(() => {
    homeworkStore.mgr.setNavigateCallback((path, options) => navigate(path, options));
    homeworkStore.mgr.loadNotes();
  }, [homeworkStore, navigate]);

  // Sync HomeworkListStore to URL on every path change
  useEffect(() => {
    homeworkStore.mgr.setCurrentNoteFromPath(location.pathname);
  }, [location.pathname, homeworkStore]);

  return (
    <div className="main-container">
      <h1 className="visually-hidden">Language Coach</h1>
      <TopNavBar
        currentNoteName={currentNoteName}
        onNoteNameClick={() => noteListManager.handleNoteNameClick(location.pathname)}
        onHomeworkClick={() => homeworkStore.mgr.togglePicker()}
        homeworkStore={homeworkStore}
      />
      <div className="main-block">
        <Routes>
          <Route
            path="/"
            element={<NoteWindowPage key={location.pathname} noteManager={noteManager} />}
          />
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
          <Route path="/homework" element={<HomeworkLab homeworkStore={homeworkStore} />} />
          <Route path="/homework/:noteId" element={<HomeworkLab homeworkStore={homeworkStore} />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;