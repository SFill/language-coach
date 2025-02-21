import React, { useState, useRef, useEffect } from 'react';

function App() {
  const [chatList, setChatList] = useState([]);         // All existing chats
  const [currentChatId, setCurrentChatId] = useState(null);
  const [messages, setMessages] = useState([]);         // Current chat's messages
  const [input, setInput] = useState('');
  const chatContainerRef = useRef(null);

  // ----------------------------------------
  // 1. LOAD ALL CHATS (sorted by id ascending)
  // ----------------------------------------
  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/coach/chat/');
      if (!response.ok) {
        console.error('Failed to fetch chats');
        return;
      }
      let data = await response.json();
      // Sort by id ascending
      data = data.sort((a, b) => a.id - b.id);
      setChatList(data);
    } catch (error) {
      console.error('Error fetching chats:', error);
    }
  };

  // ----------------------------------------
  // 2. LOAD A SELECTED CHAT'S MESSAGES
  // ----------------------------------------
  const loadChat = async (id) => {
    try {
      const response = await fetch(`http://localhost:8000/api/coach/chat/${id}`);
      if (!response.ok) {
        console.error('Failed to load chat');
        return;
      }
      const chatData = await response.json();
      setCurrentChatId(chatData.id);

      // Convert from [{role, content}, ...] into our local [{sender, text}, ...]
      if (chatData.history && Array.isArray(chatData.history.content)) {
        const loadedMessages = chatData.history.content.map((item) => {
          return {
            sender: item.role === 'user' ? 'user' : 'bot',
            text: item.content,
          };
        });
        setMessages(loadedMessages);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading chat:', error);
    }
  };

  // ----------------------------------------
  // 3. CREATE A NEW CHAT
  // ----------------------------------------
  const createNewChat = async () => {
    const newChat = {
      name: new Date().toLocaleString(), // Use date/time as name
      history: { content: [] },
    };
    try {
      const response = await fetch('http://localhost:8000/api/coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChat),
      });
      if (!response.ok) {
        console.error('Failed to create new chat');
        return null;
      }
      const chatData = await response.json();
      return chatData;
    } catch (error) {
      console.error('Error creating new chat:', error);
      return null;
    }
  };

  // ----------------------------------------
  // 4. SEND A MESSAGE TO THE BACKEND
  // ----------------------------------------
  const sendMessageToServer = async (chatId, userText) => {
    try {
      const response = await fetch(`http://localhost:8000/api/coach/chat/${chatId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
      });
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      const data = await response.json();
      return data.chat_bot_message; // The assistant's reply
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  // ----------------------------------------
  // 5. HANDLE SENDING A USER MESSAGE
  // ----------------------------------------
  const handleSend = async () => {
    if (!input.trim()) return;

    // Add user's message locally
    const userMessage = { sender: 'user', text: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    const userText = input.trim();
    setInput('');

    try {
      let chatId = currentChatId;
      // If no active chat, create a new one
      if (!chatId) {
        const newChat = await createNewChat();
        if (!newChat) return;
        chatId = newChat.id;
        setCurrentChatId(chatId);
        setChatList((prev) => [...prev, newChat]); // Add to side menu
      }

      // Send message to backend, get bot reply
      const botReply = await sendMessageToServer(chatId, userText);
      // Add bot's reply locally
      const botMessage = { sender: 'bot', text: botReply };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      const errorMessage = {
        sender: 'bot',
        text: 'Sorry, something went wrong. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  // ----------------------------------------
  // 6. AUTO-SCROLL WHEN MESSAGES CHANGE
  // ----------------------------------------
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="main-container">
      {/* The .main-container uses flex from your CSS and centers content */}
      <div 
        className="app-container" 
        /* Because your CSS sets .app-container to column,
           we override it here to row so the side menu 
           appears beside the chat area. 
           If you want to keep column layout, you'll need
           a different approach. */
        style={{ display: 'flex', flexDirection: 'row', width: '70%', maxWidth: '1000px' }}
      >
        {/* --------------------- Sidecar Menu ----------------------- */}
        <div 
          className="sidecar-menu" 
          style={{
            width: '200px',
            borderRight: '1px solid #ccc',
            marginRight: '20px',
          }}
        >
          <h3>Chats</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {chatList.map((chat) => (
              <li
                key={chat.id}
                style={{
                  padding: '8px',
                  margin: '4px 0',
                  backgroundColor: chat.id === currentChatId ? '#ececec' : '#fff',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
                onClick={() => loadChat(chat.id)}
              >
                {/* Chat name is date/time */}
                {chat.name} <br />
                <small>(ID: {chat.id})</small>
              </li>
            ))}
          </ul>
        </div>

        {/* --------------------- Chat + Input Section ----------------------- */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/*  Chat container  */}
          <div className="chat-container" ref={chatContainerRef}>
            {messages.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.sender}`}>
                {msg.text}
              </div>
            ))}
          </div>

          {/*  Input container  */}
          <div className="input-container">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              placeholder="Type your message here..."
            />
            <button onClick={handleSend}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
