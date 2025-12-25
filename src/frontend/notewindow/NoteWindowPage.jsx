import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import NoteWindow from './NoteWindow';
import MessageInput from '../MessageInput/index';
import SideDictionaryPanel from '../SideDictionaryPanel';
import NoteImagesList from './NoteImagesList';
import { uploadNoteImage } from '../api';
import './NoteWindowPage.css';

function NoteWindowPage({ noteManager }) {
    const { noteId } = useParams();
    const [dictionaryWord, setDictionaryWord] = useState('');
    const [noteBlocks, setNoteBlocks] = useState([]);
    const [maxNoteBlockId, setMaxNoteBlockId] = useState(null);

    const imagesListRef = useRef(null);
    const noteBlockInputRef = useRef(null);
    
    // Subscribe to NoteManager state changes
    useEffect(() => {
        if (!noteManager) return;
        
        const unsubscribe = noteManager.subscribe((state) => {
            console.log(state)
            setNoteBlocks(state.noteBlocks);
            setMaxNoteBlockId(state.maxNoteBlockId);
        });
        
        // Get initial state immediately
        const initialState = noteManager.getState();
        setNoteBlocks(initialState.noteBlocks);
        setMaxNoteBlockId(initialState.maxNoteBlockId);
        
        return unsubscribe;
    }, [noteManager]);

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
                    onSendQuestion={(questionText) => noteManager.handleSendQuestion(noteId, questionText)}
                />
                <MessageInput
                    ref={noteBlockInputRef}
                    onSend={(message, isNote) => noteManager.handleSend(noteId, message, isNote)}
                    onAttachImage={handleAttachImage}
                />
            </div>
            <div className={"dictionary-area" + (dictionaryWord ? "" : " hidden")}>
                <SideDictionaryPanel word={dictionaryWord} onClose={() => setDictionaryWord('')} />
            </div>
        </div>
    );
}

export default NoteWindowPage;
