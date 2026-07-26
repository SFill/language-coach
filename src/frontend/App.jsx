import React, { useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router';
import WordListPage from './wordlist/WordListPage';
import WordlistProvider from './wordlist/WordlistContext';
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
  const navigate = useNavigate();
  const location = useLocation();

  // Create HomeworkListStore instance (singleton)
  const homeworkStore = useMemo(() => new HomeworkListStore(), []);

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
        onHomeworkClick={() => homeworkStore.mgr.togglePicker()}
        homeworkStore={homeworkStore}
      />
      <div className="main-block">
        <Routes>
          <Route path="/" element={<HomeworkLab homeworkStore={homeworkStore} />} />
          <Route path="/wordlist" element={<WordListPage />} />
          <Route path="/homework/:noteId" element={<HomeworkLab homeworkStore={homeworkStore} />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;