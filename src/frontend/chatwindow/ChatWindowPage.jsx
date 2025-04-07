import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import ChatWindow from './ChatWindow';
import MessageInput from '../MessageInput/index';
import SideDictionaryPanel from '../SideDictionaryPanel';
import { fetchChatById, sendMessage, createNewChat } from '../api';
import './ChatWindowPage.css';

function ChatWindowPage({ onChatCreated }) {
    const { chatId } = useParams(); // Get chatId from URL path parameter
    const navigate = useNavigate(); // React Router's navigate function
    const [messages, setMessages] = useState([]);
    const [dictionaryWord, setDictionaryWord] = useState('');
    const [activeChatId, setActiveChatId] = useState(chatId);
    const [isCreatingChat, setIsCreatingChat] = useState(false);

    // Use a ref to track if we're currently loading a chat to prevent duplicate API calls
    const isLoadingChat = useRef(false);

    useEffect(() => {
        // Set chatId as the active chat when it changes from URL
        if (chatId) {
            setActiveChatId(chatId);
        }
        console.log("[chatId]) " + chatId)
    }, [chatId]);

    // Separate effect to handle loading chat data when activeChatId changes
    useEffect(() => {
        if (activeChatId && !isLoadingChat.current) {
            loadChat(activeChatId);
        }
        console.log("[activeChatId]) " + activeChatId)
    }, [activeChatId]);

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
    };

    const ensureActiveChatId = async () => {
        // If we already have an active chat ID, return it
        if (activeChatId) {
            return activeChatId;
        }
        
        // If we're already creating a chat, don't create another one
        if (isCreatingChat) {
            return null;
        }

        try {
            setIsCreatingChat(true);
            // Create a new chat if no active chat
            const newChat = await createNewChat();

            if (newChat && newChat.id) {
                const newChatId = newChat.id;
                setActiveChatId(newChatId);

                // Update the URL without triggering a navigation/reload using history.replaceState
                window.history.replaceState({}, '', `/chat/${newChatId}`);

                // Notify parent component that a new chat was created
                if (onChatCreated) {
                    onChatCreated(newChatId);
                }

                return newChatId;
            }
        } catch (error) {
            console.error('Failed to create new chat:', error);
            return null;
        } finally {
            setIsCreatingChat(false);
        }
        return null;
    };

    const handleSend = async (message, isNote = false) => {
        if (!message.trim()) return;

        // Add user message to UI immediately
        const userMessage = { sender: 'user', text: message.trim() };
        setMessages(prev => [...prev, userMessage]);

        try {
            // Ensure we have a valid chat ID before sending the message
            const chatId = await ensureActiveChatId();
            
            if (!chatId) {
                setMessages(prev => [...prev, { sender: 'bot', text: 'Error: Could not create or find an active chat.' }]);
                return;
            }
            
            // After we have a valid chat ID, navigate to the new chat URL if we're at root
            // This needs to happen after we've added the user message to the state
            if (window.location.pathname === '/' && chatId !== activeChatId) {
                // Use React Router's navigate after ensuring we've updated our local state
                setTimeout(() => {
                    navigate(`/chat/${chatId}`, { replace: true });
                }, 0);
            }
            
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