import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router'; // Keep using 'react-router' if that's what's available
import ChatListPage from './ChatListPage';
import ChatWindowPage from './chatwindow/ChatWindowPage';
import WordListPage from './wordlist/WordListPage';
import { fetchChats, deleteChat } from './api';
import './App.css';

// Main App component to set up routes
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

// Content component that has access to router hooks
function AppContent() {
  const [chatList, setChatList] = useState([]);
  const [currentChatName, setCurrentChatName] = useState(null);
  const [currentChatId, setCurrentChatId] = useState(null);
  const navigate = useNavigate(); // React Router's navigate function
  const location = useLocation(); // Get current location

  // Extract chatId from location pathname instead of using useParams
  useEffect(() => {
    loadChats();

    if (location.pathname.match(/\/chat\/(\d+)/) || location.pathname == '\/') {
      // Extract chatId from location pathname using regex
      const match = location.pathname.match(/\/chat\/(\d+)/);
      const chatIdFromPath = match ? parseInt(match[1]) : null;
      // set it, null if it's a default page
      setCurrentChatId(chatIdFromPath);
    }

  }, [location.pathname]);

  // Handle selection when chatList changes
  useEffect(() => {
    let foundChatName = null;
    if (chatList.length > 0 && currentChatId) {
      const currentChat = chatList.find(chat => chat.id === currentChatId);

      if (currentChat) {
        foundChatName = currentChat.name
      }
    }
    setCurrentChatName(foundChatName)
  }, [chatList, currentChatId]);

  const loadChats = async () => {
    const chats = await fetchChats();
    setChatList(chats);
  };

  const handleChatSelect = (chatId) => {
    setCurrentChatId(chatId);
    // Navigate without page reload
    navigate(`/chat/${chatId}`);
  };

  const onDeleteChat = async (chatId) => {
    if (!chatId) return;
    await deleteChat(chatId);
    const updatedChats = chatList.filter(chat => chat.id !== chatId);
    setChatList(updatedChats);
    if (currentChatId === chatId) {
      setCurrentChatId(null);
      // Navigate to chat list if we deleted the current chat
      navigate('/chatlist');
    }
  };

  // Function to handle chat name click
  const handleChatNameClick = () => {
    const path = location.pathname;
    // Check if we're already on a chat page
    if (path === '/' || path.startsWith('/chat/')) {
      // If on home or chat page, go to chat list
      navigate('/chatlist');
    } else {
      // If we have a current chat ID, go to that chat
      if (currentChatId) {
        navigate(`/chat/${currentChatId}`);
      } else {
        // Otherwise go to home page
        navigate('/');
      }
    }
  };


  return (
    <div className="main-container">
      <nav className="navbar">
        <h3 onClick={handleChatNameClick} style={{ cursor: 'pointer', color: 'inherit' }}>
          {currentChatName || "Select Chat"}
        </h3>
        <div className="nav-links">
          <Link to="/">New chat</Link>
          <Link to="/wordlist">My words</Link>
        </div>
      </nav>
      <div className="main-block">
        <Routes>
          {/* Root path directly shows ChatWindowPage, no redirection */}
          <Route
            path="/"
            element={<ChatWindowPage key={location.pathname} />}
          />

          {/* Individual chat route with path parameter */}
          <Route
            path="/chat/:chatId"
            element={<ChatWindowPage key={location.pathname} />}
          />

          <Route path="/wordlist" element={<WordListPage />} />
          <Route
            path="/chatlist"
            element={
              <ChatListPage
                chatList={chatList}
                currentChatId={currentChatId}
                loadChat={handleChatSelect}
                deleteChat={onDeleteChat}
              />
            }
          />
        </Routes>
      </div>
    </div>
  );
}

export default App;