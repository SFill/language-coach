import React, { useState, useEffect } from 'react';
import ChatWindow from './ChatWindow';
import MessageInput from '../MessageInput/index';
import SideDictionaryPanel from '../SideDictionaryPanel';
import { fetchChatById, sendMessage } from '../api';
import './ChatWindowPage.css';

function ChatWindowPage({ currentChatId }) {
    const [messages, setMessages] = useState([]);
    const [dictionaryWord, setDictionaryWord] = useState('');

    useEffect(() => {
        if (currentChatId) {
            loadChat(currentChatId);
            // Update URL with current chatId
            const params = new URLSearchParams(window.location.search);
            params.set('chatId', currentChatId);
            window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
        }
    }, [currentChatId]);

    const loadChat = async (id) => {
        const chatData = await fetchChatById(id);
        if (chatData) {
            setMessages(
                chatData.history?.content?.map((item) => ({
                    sender: item.role === 'user' ? 'user' : 'bot',
                    text: item.content,
                })) || []
            );
        }
    };

    const handleSend = async (message, isNote = false) => {
        if (!message.trim()) return;
        setMessages(prev => [...prev, { sender: 'user', text: message.trim() }]);
        try {
            const botReply = await sendMessage(currentChatId, { message, is_note: isNote });
            if (!botReply) return;
            setMessages(prev => [...prev, { sender: 'bot', text: botReply }]);
        } catch (error) {
            setMessages(prev => [...prev, { sender: 'bot', text: 'Error sending message' }]);
        }
    };

    return (
        <div className="page">
            <div className="left-area"></div>
            <div className="chat-window-page">
                <ChatWindow messages={messages} onCheckInDictionary={setDictionaryWord} />
                <MessageInput onSend={handleSend} />
            </div>
            <div className={"dictionary-area" + (dictionaryWord ? "" : " hidden")}>
                <SideDictionaryPanel word={dictionaryWord} onClose={() => setDictionaryWord('')} />
            </div>
        </div>

    );
}

export default ChatWindowPage;
