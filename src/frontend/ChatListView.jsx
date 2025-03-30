import React from 'react';
import './ChatListView.css';

const ChatListView = ({ chatList, currentChatId, onSelectChat, onDeleteChat }) => {
  return (
    <div className="chat-list-view-container">
      {chatList.map(chat => (
        <div 
          key={chat.id} 
          className={`chat-list-item ${currentChatId === chat.id ? 'active' : ''}`}
          onClick={() => onSelectChat(chat.id)}
        >
          <div className="chat-details">
            <span className="chat-name">{chat.name}</span>
            {/* Placeholder for future details */}
            <span className="chat-placeholder">[Additional Info]</span>
          </div>
          <button 
            className="delete-chat-button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteChat(chat.id);
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
};

export default ChatListView;
