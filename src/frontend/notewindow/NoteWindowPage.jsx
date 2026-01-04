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
    const [activeImageIds, setActiveImageIds] = useState([]);
    const [isImagesPanelCollapsed, setIsImagesPanelCollapsed] = useState(false);

    const imagesListRef = useRef(null);
    const noteBlockInputRef = useRef(null);
    const noteWindowRef = useRef(null);
    
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

    const handleImageClick = (imageId) => {
        // Find the note block that contains this image
        const noteBlockWithImage = noteBlocks.find(block =>
            block.image_ids && block.image_ids.includes(imageId)
        );
        
        if (noteBlockWithImage && noteWindowRef.current) {
            noteWindowRef.current.scrollToNoteBlock(noteBlockWithImage.id);
        }
    };

    const handleActiveNoteChange = (noteBlockId) => {
        // Find the note block and get its image IDs
        const noteBlock = noteBlocks.find(block => block.id === noteBlockId);
        if (noteBlock && noteBlock.image_ids) {
            setActiveImageIds(noteBlock.image_ids);
        } else {
            setActiveImageIds([]);
        }
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
            {!isImagesPanelCollapsed && (
                <div className="left-area">
                   <NoteImagesList
                        ref={imagesListRef}
                        noteId={noteId}
                        noteBlocks={noteBlocks}
                        onImageUpload={handleImageUpload}
                        onImageClick={handleImageClick}
                        activeImageIds={activeImageIds}
                        onToggleCollapse={() => setIsImagesPanelCollapsed(true)}
                    />
                </div>
            )}
            {isImagesPanelCollapsed && (
                <button
                    className="expand-images-button"
                    onClick={() => setIsImagesPanelCollapsed(false)}
                    title="Show images panel"
                >
                    ▶ Images
                </button>
            )}
            <div className="note-window-page">
                <NoteWindow
                    ref={noteWindowRef}
                    noteBlocks={noteBlocks}
                    onCheckInDictionary={setDictionaryWord}
                    noteId={noteId}
                    noteBlockInputRef={noteBlockInputRef}
                    onImageUploaded={handleImageUpload}
                    onSendQuestion={(questionText) => noteManager.handleSendQuestion(noteId, questionText)}
                    onActiveNoteChange={handleActiveNoteChange}
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
