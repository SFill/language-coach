import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import NoteWindow from './NoteWindow';
import MessageInput from '../MessageInput/index';
import SideDictionaryPanel from '../SideDictionaryPanel';
import NoteImagesList from './NoteImagesList';
import { fetchNoteById, sendNoteBlock, createNewNote, uploadNoteImage, sendQuestion } from '../api';
import './NoteWindowPage.css';

function NoteWindowPage({ onNoteCreated }) {
    const { noteId } = useParams(); // Get noteId from URL path parameter
    const navigate = useNavigate(); // React Router's navigate function
    const location = useLocation();
    const [noteBlocks, setNoteBlocks] = useState([]);
    const [dictionaryWord, setDictionaryWord] = useState('');
    const [maxNoteBlockId, setMaxNoteBlockId] = useState(null);

    // Use a ref to track if we're currently loading a note to prevent duplicate API calls
    const isLoadingNote = useRef(false);
    const imagesListRef = useRef(null);
    const noteBlockInputRef = useRef(null);

    useEffect(() => {

        // Set noteId as the active note when it changes from URL
        if (noteId) {
            loadNote(noteId);
        }
        console.log("[noteId]) " + noteId)
        // do not include location.state because we cover initial message sending by changing noteId
    }, [noteId]);


    const loadNote = async (id) => {
        if (isLoadingNote.current) return;

        try {
            isLoadingNote.current = true;
            console.log('Loading note:', id); // Debug log

            const noteData = await fetchNoteById(id);
            if (noteData) {
                setNoteBlocks(
                    noteData.note_blocks
                );
                setMaxNoteBlockId(noteData.max_note_block_id);
            }
        } catch (error) {
            console.error('Error loading note:', error);
        } finally {
            isLoadingNote.current = false;
        }

        const initialNoteBlock = location.state?.initialMessage;

        if (initialNoteBlock) {
            // Clear state to prevent reprocessing
            navigate(location.pathname, { replace: true, state: {} });

            // Process the note block
            await handleSend(initialNoteBlock.message, initialNoteBlock.isNote);
        }
        console.log("location.state " + location.state)
    };


    const handleSend = async (message, isNote = false) => {
        if (!message.trim()) return;

        if (!noteId) {
            try {
                const newNote = await createNewNote();
                // Notify parent component that a new note was created
                onNoteCreated(newNote.id, { message, isNote });
                return
            } catch (error) {
                setNoteBlocks(prev => [...prev, { sender: 'bot', content: 'Error: Could not create or find an active note.' }]);
                console.log(error);
                return;
            }
        }


        // Add user note block to UI immediately
        // TODO reimplement with normal id
        const newNoteBlockId = maxNoteBlockId+1
        setMaxNoteBlockId(newNoteBlockId)
        const userNoteBlock = { sender: 'user', content: message.trim(), id: newNoteBlockId};
        setNoteBlocks(prev => [...prev, userNoteBlock]);

        try {

            const [userNoteBlock, botReply] = await sendNoteBlock(noteId, { 'block' : message, is_note: isNote });
            if (!botReply) return;

            setNoteBlocks(prev => [...prev, botReply]);
        } catch (error) {
            console.error('Error sending note block:', error);
            setNoteBlocks(prev => [...prev, { sender: 'bot', content: 'Error sending note block' }]);
        }
    };

    const handleSendQuestion = async (questionText, noteBlockId) => {
        if (!questionText.trim() || !noteId) return;

        try {
            // Add user question to UI immediately
            const newNoteBlockId = maxNoteBlockId + 1;
            setMaxNoteBlockId(newNoteBlockId + 1); // Reserve ID for bot response too
            const userQuestion = {
                sender: 'user',
                content: questionText.trim(),
                id: newNoteBlockId,
                is_note: false,
                created_at: new Date().toISOString()
            };
            setNoteBlocks(prev => [...prev, userQuestion]);

            // Send question and get response
            const [userNoteBlock, botReply] = await sendQuestion(noteId, questionText);
            
            // Update the user note block with server response and add bot reply
            if (botReply) {
                setNoteBlocks(prev => {
                    // Replace the optimistic user note block and add bot reply
                    const updated = prev.map(block =>
                        block.id === newNoteBlockId ? { ...userNoteBlock, id: newNoteBlockId } : block
                    );
                    return [...updated, { ...botReply, id: newNoteBlockId + 1 }];
                });
            }
        } catch (error) {
            console.error('Error sending question:', error);
            // Add error note block
            setNoteBlocks(prev => [...prev, {
                sender: 'bot',
                content: 'Error sending question. Please try again.',
                id: maxNoteBlockId + 2,
                created_at: new Date().toISOString()
            }]);
            setMaxNoteBlockId(maxNoteBlockId + 2);
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
        if (!noteId || !files.length) return;

        try {
            for (const file of files) {
                const uploadedImage = await uploadNoteImage(noteId, file);
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
               <NoteImagesList
                    ref={imagesListRef}
                    noteId={noteId}
                    onImageUpload={handleImageUpload}
                    onImageReference={handleImageReference}
                />
            </div>
            <div className="note-window-page">
                <NoteWindow
                    noteBlocks={noteBlocks}
                    onCheckInDictionary={setDictionaryWord}
                    noteId={noteId}
                    noteBlockInputRef={noteBlockInputRef}
                    onImageUploaded={handleImageUpload}
                    onSendQuestion={handleSendQuestion}
                />
                <MessageInput ref={noteBlockInputRef} onSend={handleSend} onAttachImage={handleAttachImage} />
            </div>
            <div className={"dictionary-area" + (dictionaryWord ? "" : " hidden")}>
                <SideDictionaryPanel word={dictionaryWord} onClose={() => setDictionaryWord('')} />
            </div>
        </div>
    );
}

export default NoteWindowPage;
