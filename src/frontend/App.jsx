import React, { useState, useEffect } from 'react';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import MessageInput from './MessageInput';
import ReverseContext from './ReverseContext';
import { fetchChats, fetchChatById, createNewChat, sendMessage } from './api';
import './App.css';

function App() {
  const [chatList, setChatList] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    loadChats();
  }, []);

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

  const handleSend = async (message) => {
    if (!message.trim()) return;

    // Add user's message immediately
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

  return (
    <div className="main-container">
      <div className="app-container">
        <div className="chat">
        <ChatList chatList={chatList} currentChatId={currentChatId} loadChat={loadChat} />
          <div className="chat-area">
            <ChatWindow messages={messages} />
            <MessageInput onSend={handleSend} />
          </div>
        </div>

        <ReverseContext />
      </div>
    </div>
  );
}

export default App;
