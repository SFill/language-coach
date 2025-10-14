import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import ChatWindow from './ChatWindow';
import MessageInput from '../MessageInput/index';
import SideDictionaryPanel from '../SideDictionaryPanel';
import ChatImagesList from './ChatImagesList';
import { fetchChatById, sendMessage, createNewChat, uploadChatImage, sendQuestion } from '../api';
import './ChatWindowPage.css';

function ChatWindowPage({ onChatCreated }) {
    const { chatId } = useParams(); // Get chatId from URL path parameter
    const navigate = useNavigate(); // React Router's navigate function
    const location = useLocation();
    const [messages, setMessages] = useState([]);
    const [dictionaryWord, setDictionaryWord] = useState('');
    const [maxMessageId, setMaxMessageId] = useState(null);

    // Use a ref to track if we're currently loading a chat to prevent duplicate API calls
    const isLoadingChat = useRef(false);
    const imagesListRef = useRef(null);
    const messageInputRef = useRef(null);

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
                    chatData.messages
                );
                setMaxMessageId(chatData.max_message_id);
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
                setMessages(prev => [...prev, { sender: 'bot', content: 'Error: Could not create or find an active chat.' }]);
                console.log(error);
                return;
            }
        }


        // Add user message to UI immediately
        // TODO reimplement with normal id
        const newMessageId = maxMessageId+1
        setMaxMessageId(newMessageId)
        const userMessage = { sender: 'user', content: message.trim(), id: newMessageId};
        setMessages(prev => [...prev, userMessage]);

        try {

            const [userMessage, botReply] = await sendMessage(chatId, { message, is_note: isNote });
            if (!botReply) return;

            setMessages(prev => [...prev, botReply]);
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages(prev => [...prev, { sender: 'bot', content: 'Error sending message' }]);
        }
    };

    const handleSendQuestion = async (questionText, noteId) => {
        if (!questionText.trim() || !chatId) return;

        try {
            // Add user question to UI immediately
            const newMessageId = maxMessageId + 1;
            setMaxMessageId(newMessageId + 1); // Reserve ID for bot response too
            const userQuestion = {
                sender: 'user',
                content: questionText.trim(),
                id: newMessageId,
                is_note: false,
                created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, userQuestion]);

            // Send question and get response
            const [userMessage, botReply] = await sendQuestion(chatId, questionText);
            
            // Update the user message with server response and add bot reply
            if (botReply) {
                setMessages(prev => {
                    // Replace the optimistic user message and add bot reply
                    const updated = prev.map(msg =>
                        msg.id === newMessageId ? { ...userMessage, id: newMessageId } : msg
                    );
                    return [...updated, { ...botReply, id: newMessageId + 1 }];
                });
            }
        } catch (error) {
            console.error('Error sending question:', error);
            // Add error message
            setMessages(prev => [...prev, {
                sender: 'bot',
                content: 'Error sending question. Please try again.',
                id: maxMessageId + 2,
                created_at: new Date().toISOString()
            }]);
            setMaxMessageId(maxMessageId + 2);
        }
    };

    const handleImageUpload = (uploadedImage) => {
        // Optional: Show a notification or refresh something
        console.log('Image uploaded:', uploadedImage);
        // Refresh the images list
        if (imagesListRef.current && imagesListRef.current.loadImages) {
            imagesListRef.current.loadImages();
        }
    };

    const handleImageReference = (image) => {
        // This could trigger insertion of image reference into the message input
        // For now, we'll just log it
        console.log('Image clicked for reference:', image);
    };

    const handleAttachImage = async (files) => {
        if (!chatId || !files.length) return;

        try {
            for (const file of files) {
                const uploadedImage = await uploadChatImage(chatId, file);
                handleImageUpload(uploadedImage);
            }
        } catch (error) {
            console.error('Error uploading images:', error);
            alert('Error uploading images. Please try again.');
        }
    };

    return (
        <div className="page">
            <div className="left-area">
               <ChatImagesList 
                    ref={imagesListRef}
                    chatId={chatId} 
                    onImageUpload={handleImageUpload}
                    onImageReference={handleImageReference}
                />
            </div>
            <div className="chat-window-page">
                <ChatWindow
                    messages={messages}
                    onCheckInDictionary={setDictionaryWord}
                    chatId={chatId}
                    messageInputRef={messageInputRef}
                    onImageUploaded={handleImageUpload}
                    onSendQuestion={handleSendQuestion}
                />
                <MessageInput ref={messageInputRef} onSend={handleSend} onAttachImage={handleAttachImage} />
            </div>
            <div className={"dictionary-area" + (dictionaryWord ? "" : " hidden")}>
                <SideDictionaryPanel word={dictionaryWord} onClose={() => setDictionaryWord('')} />
            </div>
        </div>
    );
}

export default ChatWindowPage;
