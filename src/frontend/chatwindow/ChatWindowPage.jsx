import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import ChatWindow from './ChatWindow';
import MessageInput from '../MessageInput/index';
import SideDictionaryPanel from '../SideDictionaryPanel';
import { fetchChatById, sendMessage, createNewChat } from '../api';
import './ChatWindowPage.css';

function ChatWindowPage({ onChatCreated }) {
    const { chatId } = useParams(); // Get chatId from URL path parameter
    const navigate = useNavigate(); // React Router's navigate function
    const location = useLocation();
    const [messages, setMessages] = useState([]);
    const [dictionaryWord, setDictionaryWord] = useState('');

    // Use a ref to track if we're currently loading a chat to prevent duplicate API calls
    const isLoadingChat = useRef(false);

    useEffect(() => {

        // Set chatId as the active chat when it changes from URL
        if (chatId) {
            loadChat(chatId);
        }
        console.log("[chatId]) " + chatId)
        // do not include location.state because we cover initial message sending by changing chatId
    }, [chatId]);


    const loadChat = async (id) => {
        if (isLoadingChat.current) return;

        try {
            isLoadingChat.current = true;
            console.log('Loading chat:', id); // Debug log

            const chatData = await fetchChatById(id);
            if (chatData) {
                setMessages(
                    chatData.history?.content?.map((item) => ({
                        sender: item.role === 'user' ? 'user' : 'bot',
                        text: item.content,
                    })) || []
                );
            }
        } catch (error) {
            console.error('Error loading chat:', error);
        } finally {
            isLoadingChat.current = false;
        }

        const initialMessage = location.state?.initialMessage;

        if (initialMessage) {
            // Clear state to prevent reprocessing
            navigate(location.pathname, { replace: true, state: {} });

            // Process the message
            await handleSend(initialMessage.message, initialMessage.isNote);
        }
        console.log("location.state " + location.state)
    };


    const handleSend = async (message, isNote = false) => {
        if (!message.trim()) return;

        if (!chatId) {
            try {
                const newChat = await createNewChat();
                // Notify parent component that a new chat was created
                onChatCreated(newChat.id, { message, isNote });
                return
            } catch (error) {
                setMessages(prev => [...prev, { sender: 'bot', text: 'Error: Could not create or find an active chat.' }]);
                console.log(error);
                return;
            }
        }


        // Add user message to UI immediately
        const userMessage = { sender: 'user', text: message.trim() };
        setMessages(prev => [...prev, userMessage]);

        try {

            const botReply = await sendMessage(chatId, { message, is_note: isNote });
            if (!botReply) return;

            setMessages(prev => [...prev, { sender: 'bot', text: botReply }]);
        } catch (error) {
            console.error('Error sending message:', error);
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