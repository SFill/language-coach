import React from 'react';
import { useNavigate } from 'react-router';
import ChatListView from './ChatListView';

const ChatListPage = ({ chatList, currentChatId, loadChat, startNewChat, deleteChat }) => {
  const navigate = useNavigate();

  const handleSelect = (chatId) => {
    loadChat(chatId);
    navigate("/"); // Navigate back to the chat window page after selection
  };

  return (
    <div className="page">
      <ChatListView 
        chatList={chatList} 
        currentChatId={currentChatId} 
        onSelectChat={handleSelect}
        onDeleteChat={deleteChat}
      />
    </div>
  );
};

export default ChatListPage;
