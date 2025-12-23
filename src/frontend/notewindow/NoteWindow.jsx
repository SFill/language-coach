import React, { useState, useEffect, useRef } from 'react';
import NoteBlock from './NoteBlock';
import NoteToolbar from './NoteToolbar';
import './NoteWindow.css';
import { useWordlist } from '../wordlist/WordlistContext';
import { uploadNoteImage, sendQuestion } from '../api';

const NoteWindow = ({ noteBlocks, onCheckInDictionary, noteId, noteBlockInputRef, onImageUploaded, onSendQuestion }) => {
  const noteContainerRef = useRef(null);
  const toolbarRef = useRef(null);

  // Create refs for each NoteBlock (using index as key for simplicity)
  const noteBlockRefs = useRef([]);

  // Toolbar state: style (including position), active note block ref, and whether the selection is translated.
  const [toolbarStyle, setToolbarStyle] = useState({ display: 'none' });
  const [activeNoteBlockRef, setActiveNoteBlockRef] = useState(null);
  const [selectedText, setSelectedText] = useState('');
  const [activeIsTranslated, setActiveIsTranslated] = useState(false);
  const [isToolbarVisible, setIsToolbarVisible] = useState(false);

  // No separate tiles state - tiles are derived from noteBlocks

  // Use the wordlist context
  // Load wordlists is done internally
  const { 
    wordlists, 
    loading: wordlistsLoading, 
    error: wordlistsError,
    addWordToList, 
    moveWordBetweenLists, 
    createNewListWithWord, 
    refreshWordlists
  } = useWordlist();


  useEffect(() => {
    // Scroll to bottom when new note blocks arrive
    if (noteContainerRef.current) {
      noteContainerRef.current.scrollTop = noteContainerRef.current.scrollHeight;
    }
  }, [noteBlocks]);

  // Single paste handler for images: uploads and inserts refs into editor
  useEffect(() => {
    const handlePaste = async (event) => {
      if (!noteId) return;
      const clipboard = event.clipboardData;
      if (!clipboard) return;

      const items = Array.from(clipboard.items || []);
      const imageItems = items.filter((i) => i.type && i.type.startsWith('image/'));
      if (imageItems.length === 0) return;

      event.preventDefault();

      // Convert items to Files, ensure a name exists
      const files = [];
      for (const item of imageItems) {
        const file = item.getAsFile();
        if (file) {
          const ext = (file.type?.split('/')?.[1] || 'png');
          const named = new File([file], `pasted-image-${Date.now()}.${ext}`, { type: file.type || 'image/png' });
          files.push(named);
        }
      }

      for (const file of files) {
        try {
          const uploaded = await uploadNoteImage(noteId, file);
          // Notify images list to refresh
          if (onImageUploaded) onImageUploaded(uploaded);
          // Insert a reference into the editor
          const refText = `@image:${uploaded.id} `;
          if (noteBlockInputRef && noteBlockInputRef.current && noteBlockInputRef.current.insertTextAtCursor) {
            noteBlockInputRef.current.insertTextAtCursor(refText);
          }
        } catch (err) {
          console.error('Error uploading pasted image:', err);
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [noteId, noteBlockInputRef, onImageUploaded]);

  useEffect(() => {
    // Single global mouseup handler for event delegation
    const handleGlobalMouseUp = (e) => {
      // Check if click happened inside the toolbar
      if (toolbarRef.current && toolbarRef.current.contains(e.target)) {
        // Don't hide the toolbar if clicking within it
        return;
      }
      if (isToolbarVisible) {
        // when click outside the toolbar, we want to hide it
        setIsToolbarVisible(false);
        return;
      }

      // Check if the selection is within any of our note block components
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        // No valid selection, ignore
        return;
      }

      // Find the note block component that contains this selection
      for (let i = 0; i < noteBlockRefs.current.length; i++) {
        const noteBlockRef = noteBlockRefs.current[i];
        if (noteBlockRef && noteBlockRef.current && noteBlockRef.current.checkSelectionWithinContainer) {
          if (noteBlockRef.current.checkSelectionWithinContainer()) {
            // This note block contains the selection, call its handler
            noteBlockRef.current.handleGlobalSelection(e);
            return; // Once we've found a match, don't continue checking
          }
        }
      }
    };

    // Add the single global listeners
    document.addEventListener('mouseup', handleGlobalMouseUp);

    // Clean up
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [noteBlockRefs.current.length, isToolbarVisible]); // Depend on isToolbarVisible to properly update the closure

  // Extract sentence containing the selected text using selection range
  const extractSentenceFromSelection = (noteBlockRef) => {
    if (!noteBlockRef || !noteBlockRef.current) return null;
    
    
    try {

       const currentRange = noteBlockRef.current.currentRange;

      if (!currentRange) return null;

      const noteBlockContainer = currentRange.commonAncestorContainer;
     
      
      const fullText = noteBlockContainer.textContent || noteBlockContainer.innerText || '';
      
      // Calculate absolute position of selection start in the full text
      let absoluteStart = 0;
      const walker = document.createTreeWalker(
        noteBlockContainer,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let currentNode;
      while (currentNode = walker.nextNode()) {
        if (currentNode === currentRange.startContainer) {
          absoluteStart += currentRange.startOffset;
          break;
        }
        absoluteStart += currentNode.textContent.length;
      }
      
      // Find sentence boundaries around this position
      // Look for sentence endings before the selection
      let sentenceStart = 0;
      for (let i = absoluteStart - 1; i >= 0; i--) {
        if (/[.!?]/.test(fullText[i])) {
          sentenceStart = i + 1;
          break;
        }
      }
      
      // Look for sentence endings after the selection
      let sentenceEnd = fullText.length;
      for (let i = absoluteStart; i < fullText.length; i++) {
        if (/[.!?]/.test(fullText[i])) {
          sentenceEnd = i;
          break;
        }
      }
      
      const sentence = fullText.slice(sentenceStart, sentenceEnd).trim();
      return sentence || null;
      
    } catch (error) {
      console.error('Error extracting sentence from selection:', error);
      return null;
    }
  };

  // Callback from NoteBlock when text is selected or a translated span is clicked.
  // The extra "isTranslated" flag indicates if the selection already has a translation.
  const handleTextSelect = (ref, rect, text, isTranslated = false) => {
    setActiveNoteBlockRef(ref);
    setSelectedText(text);
    setActiveIsTranslated(isTranslated);

    // Compute toolbar position relative to note container.
    const containerRect = noteContainerRef.current.getBoundingClientRect();
    const top = rect.top - containerRect.top - 40; // 40px above.
    const left = rect.left - containerRect.left;

    setToolbarStyle({
      position: 'absolute',
      top,
      left,
    });

    // Show the toolbar
    setIsToolbarVisible(true);
  };

  // Toolbar button handlers call the exposed API on the active NoteBlock.
  const handleToolbarTranslate = async (lang) => {
    if (activeNoteBlockRef && activeNoteBlockRef.current) {
      await activeNoteBlockRef.current.handleTranslate(lang);
    }
  };

  const handleToolbarRollback = () => {
    if (activeNoteBlockRef && activeNoteBlockRef.current) {
      activeNoteBlockRef.current.handleRollback();
      setIsToolbarVisible(false);
    }
  };

  const handleDictionaryLookup = () => {
    console.log('Dictionary lookup for:', selectedText);
    onCheckInDictionary(selectedText);
  };

  // Wordlist management handlers with sentence context
  const handleAddToList = async (text, listId) => {
    if (!text.trim()) return null;
    
    // Extract sentence context using selection range
    const sentenceContext = extractSentenceFromSelection(activeNoteBlockRef);
    return addWordToList(text, listId, sentenceContext);
  };

  const handleMoveToList = async (text, sourceListId, targetListId) => {
    if (!text.trim() || sourceListId === targetListId) return null;
    return moveWordBetweenLists(text, sourceListId, targetListId);
  };

  const handleCreateNewList = async (text) => {
    if (!text.trim()) return null;
    
    // Extract sentence context using selection range
    const sentenceContext = extractSentenceFromSelection(activeNoteBlockRef);
    
    return createNewListWithWord(text, null, sentenceContext);
  };

  // Group note blocks into tiles by note they relate to
  const groupTilesByNote = () => {
    let tileGroups = {};
    let currentNoteId = null;
    
    // Iterate through note blocks to find notes and questions
    noteBlocks.forEach((block) => {
      if (block.is_note) {
        // This is a note - track its ID
        currentNoteId = block.id;
        if (!tileGroups[currentNoteId]) {
          tileGroups[currentNoteId] = [];
        }
      } else {
        // This is a question following a note
        // Create tile from question and answer pair
        const tile = {
            id: block.id,
            noteId: currentNoteId,
            title: "question",
            content: block.content,
            state: 'ready',
            expanded: false,
            createdAt: block.created_at,
            error: null
          };

        if(tileGroups[currentNoteId]) tileGroups[currentNoteId].push(tile);
      }
    });
    
    return tileGroups;
  };

  // Send question about a note
  const handleSendQuestion = async (questionText, noteBlockId) => {
    if (!questionText.trim() || !noteId || !onSendQuestion) return;

    try {
      // Call the parent component's send question handler
      await onSendQuestion(questionText, noteId);
    } catch (error) {
      console.error('Failed to send question:', error);
      // Handle error - could show a toast notification
    }
  };

  // Retry failed tile - for now just log, as real implementation would need note block retry
  const handleRetryTile = async (tileId) => {
    console.log('Retry tile:', tileId);
    // In real implementation, this would retry the question by resending the note block
  };

  const tileGroups = groupTilesByNote();

  return (
    <div
      className="note-window-container"
      ref={noteContainerRef}
    >
      <div className="note-window">
        {noteBlocks.map((block, index) => {
          if (!noteBlockRefs.current[index]) {
            noteBlockRefs.current[index] = React.createRef();
          }
          if (!block.is_note) {
            return
          }
          // Get tiles for this note block if it's a note, and apply UI states
          const blockTiles = tileGroups[block.id] || [];
          
          return (
            <NoteBlock
              key={index}
              ref={noteBlockRefs.current[index]}
              block={block}
              noteId={noteId}
              tiles={blockTiles}
              onSendQuestion={handleSendQuestion}
              onRetryTile={handleRetryTile}
              onTextSelect={(rect, text, isTranslated) => {
                // Use a timeout to ensure the child event has completed.
                setTimeout(() => handleTextSelect(noteBlockRefs.current[index], rect, text, isTranslated), 0);
              }}
            />
          );
        })}
      </div>

      <NoteToolbar
        toolbarRef={toolbarRef}
        style={toolbarStyle}
        handleTranslate={handleToolbarTranslate}
        handleRollback={handleToolbarRollback}
        showDictionaryButton={() => true}
        checkInDictionary={handleDictionaryLookup}
        showRollback={activeIsTranslated}
        isVisible={isToolbarVisible}
        selectedText={selectedText}
        wordLists={wordlists}
        onAddToList={handleAddToList}
        onMoveToList={handleMoveToList}
        onCreateNewList={handleCreateNewList}
      />
    </div>
  );
};

export default NoteWindow;
