import React from 'react';
import './ChatList.css';

const ChatList = ({ chatList, currentChatId, loadChat, startNewChat }) => {
  const handleSelect = (e) => {
    loadChat(e.target.value);
  };

  return (
    <div className="chat-list">
      <select value={currentChatId || ''} onChange={handleSelect}>
        {chatList.map((chat) => (
          <option key={chat.id} value={chat.id}>
            {chat.name}
          </option>
        ))}
      </select>
      <button onClick={startNewChat}>Start a New Chat</button>
    </div>
  );
};


export default ChatList;
