import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router';
import ChatListPage from './ChatListPage';
import ChatWindowPage from './chatwindow/ChatWindowPage';
import WordListPage from './wordlist/WordListPage';
import { fetchChats, createNewChat, deleteChat } from './api';
import './App.css';

function App() {
  const [chatList, setChatList] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);

  useEffect(() => {
    loadChats();
    const params = new URLSearchParams(window.location.search);
    const chatIdFromUrl = params.get("chatId");
    if (chatIdFromUrl) {
      setCurrentChatId(chatIdFromUrl);
    }
  }, []);

  const loadChats = async () => {
    const chats = await fetchChats();
    setChatList(chats);
  };

  const handleChatSelect = (chatId) => {
    setCurrentChatId(chatId);
  };

  const startNewChat = async () => {
    const newChat = await createNewChat();
    if (newChat) {
      setCurrentChatId(newChat.id);
      setChatList(prev => [...prev, newChat]);
    }
  };

  const onDeleteChat = async (chatId) => {
    if (!chatId) return;
    await deleteChat(chatId)
    const updatedChats = chatList.filter(chat => chat.id !== chatId);
    setChatList(updatedChats);
    if (currentChatId === chatId) {
      setCurrentChatId(null);
    }
  };

  const currentChat = chatList.find(chat => chat.id === currentChatId);
  const currentChatName = currentChat ? currentChat.name : "Select Chat";

  return (
    <Router>
      <div className="main-container">
        <nav className="navbar">
          <h3>
            <Link to="/chatlist" style={{ textDecoration: 'none', color: 'inherit' }}>
              {currentChatName}
            </Link>
          </h3>
          <button onClick={startNewChat}>New Chat</button>
          <div className="nav-links">
            <Link to="/">Chat</Link>
            <Link to="/wordlist">My words</Link>
          </div>
        </nav>
        <div className="main-block">
          <Routes>
            <Route path="/" element={<ChatWindowPage currentChatId={currentChatId} />} />
            <Route path="/wordlist" element={<WordListPage />} />
            <Route
              path="/chatlist"
              element={
                <ChatListPage
                  chatList={chatList}
                  currentChatId={currentChatId}
                  loadChat={handleChatSelect}
                  startNewChat={startNewChat}
                  deleteChat={onDeleteChat}
                />
              }
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
