import React from 'react';
import ChatListView from './ChatListView';

const ChatListPage = ({ chatList, currentChatId, loadChat, deleteChat }) => {

  return (
    <div className="page">
      <ChatListView
        chatList={chatList}
        currentChatId={currentChatId}
        onSelectChat={loadChat}
        onDeleteChat={deleteChat}
      />
    </div>
  );
};

export default ChatListPage;
