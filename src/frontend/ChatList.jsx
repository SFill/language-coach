import React from 'react';
import './ChatList.css';

const ChatList = ({ chatList, currentChatId, loadChat }) => {
  return (
    <div className="chat-list">
      <h3>Chats</h3>
      <ul>
        {chatList.map(chat => (
          <li
            key={chat.id}
            className={chat.id === currentChatId ? 'active' : ''}
            onClick={() => loadChat(chat.id)}
          >
            {chat.name} <br />
            <small>(ID: {chat.id})</small>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ChatList;
