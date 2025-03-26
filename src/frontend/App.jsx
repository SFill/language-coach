import React, { useState, useEffect } from 'react';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import MessageInput from './MessageInput';
import ReverseContext from './ReverseContext';
import { fetchChats, fetchChatById, createNewChat, sendMessage } from './api';
import './App.css';
import WordLists from './WordLists';
import DictionaryPanel from './DictionaryPanel'; // Import the new component
import SideDictionaryPanel from './SideDictionaryPanel';

function App() {
  const [chatList, setChatList] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [showDictionary, setShowDictionary] = useState(false); // Toggle state

  useEffect(() => {
    loadChats();

    const params = new URLSearchParams(window.location.search);
    const chatIdFromUrl = params.get("chatId");
    if (chatIdFromUrl) {
      loadChat(chatIdFromUrl);
    }
  }, []);

  useEffect(() => {
    if (currentChatId) {
      const params = new URLSearchParams(window.location.search);
      params.set('chatId', currentChatId);
      window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  }, [currentChatId]);

  const loadChats = async () => {
    const chats = await fetchChats();
    setChatList(chats);
  };

  const loadChat = async (id) => {
    const chatData = await fetchChatById(id);
    if (chatData) {
      setCurrentChatId(chatData.id);
      setMessages(
        chatData.history?.content?.map((item) => ({
          sender: item.role === 'user' ? 'user' : 'bot',
          text: item.content,
        })) || []
      );
    }
  };

  const startNewChat = async () => {
    const newChat = await createNewChat();
    if (newChat) {
      setCurrentChatId(newChat.id);
      setChatList(prev => [...prev, newChat]);
      setMessages([]);
    }
  };

  const handleSend = async (message) => {
    if (!message.trim()) return;

    setMessages((prev) => [...prev, { sender: 'user', text: message.trim() }]);

    try {
      let chatId = currentChatId;
      if (!chatId) {
        const newChat = await createNewChat();
        if (!newChat) return;
        chatId = newChat.id;
        setCurrentChatId(chatId);
        setChatList((prev) => [...prev, newChat]);
      }

      const botReply = await sendMessage(chatId, message);
      setMessages((prev) => [...prev, { sender: 'bot', text: botReply }]);
    } catch (error) {
      setMessages((prev) => [...prev, { sender: 'bot', text: 'Error sending message' }]);
    }
  };

  const toggleDictionary = () => {
    setShowDictionary(!showDictionary);
  };

  return (
    <div className="main-container">
      <header>
        <nav className="navbar">
          <h3>Chats</h3>
          <ChatList
            chatList={chatList}
            currentChatId={currentChatId}
            loadChat={loadChat}
            startNewChat={startNewChat}
          />
          <button onClick={toggleDictionary} className="toggle-button">
            {showDictionary ? 'Hide Dictionary' : 'Show Dictionary'}
          </button>
        </nav>
      </header>
      <div className="main-block">
        <div className="left-area"></div>
        <div className="chat-area">
          <ChatWindow messages={messages} />
          <MessageInput onSend={handleSend} />

          <ReverseContext />
          <WordLists />
        </div>
        <div className="dictionary-area">
          {showDictionary && (
            <SideDictionaryPanel word="home" />
          )}
        </div>


      </div>
    </div>
  );
}

export default App;
