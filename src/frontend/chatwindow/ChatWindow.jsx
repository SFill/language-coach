import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import ChatToolbar from './ChatToolbar';
import './ChatWindow.css';
import { useWordlist } from '../wordlist/WordlistContext';
import { uploadChatImage, sendQuestion } from '../api';

const ChatWindow = ({ messages, onCheckInDictionary, chatId, messageInputRef, onImageUploaded, onSendQuestion }) => {
  const chatContainerRef = useRef(null);
  const toolbarRef = useRef(null);

  // Create refs for each ChatMessage (using index as key for simplicity)
  const messageRefs = useRef([]);

  // Toolbar state: style (including position), active message ref, and whether the selection is translated.
  const [toolbarStyle, setToolbarStyle] = useState({ display: 'none' });
  const [activeMessageRef, setActiveMessageRef] = useState(null);
  const [selectedText, setSelectedText] = useState('');
  const [activeIsTranslated, setActiveIsTranslated] = useState(false);
  const [isToolbarVisible, setIsToolbarVisible] = useState(false);

  // No separate tiles state - tiles are derived from messages

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
    // Scroll to bottom when new messages arrive
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Single paste handler for images: uploads and inserts refs into editor
  useEffect(() => {
    const handlePaste = async (event) => {
      if (!chatId) return;
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
          const uploaded = await uploadChatImage(chatId, file);
          // Notify images list to refresh
          if (onImageUploaded) onImageUploaded(uploaded);
          // Insert a reference into the editor
          const refText = `@image:${uploaded.id} `;
          if (messageInputRef && messageInputRef.current && messageInputRef.current.insertTextAtCursor) {
            messageInputRef.current.insertTextAtCursor(refText);
          }
        } catch (err) {
          console.error('Error uploading pasted image:', err);
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [chatId, messageInputRef, onImageUploaded]);

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

      // Check if the selection is within any of our message components
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        // No valid selection, ignore
        return;
      }

      // Find the message component that contains this selection
      for (let i = 0; i < messageRefs.current.length; i++) {
        const messageRef = messageRefs.current[i];
        if (messageRef && messageRef.current && messageRef.current.checkSelectionWithinContainer) {
          if (messageRef.current.checkSelectionWithinContainer()) {
            // This message contains the selection, call its handler
            messageRef.current.handleGlobalSelection(e);
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
  }, [messageRefs.current.length, isToolbarVisible]); // Depend on isToolbarVisible to properly update the closure

  // Extract sentence containing the selected text using selection range
  const extractSentenceFromSelection = (messageRef) => {
    if (!messageRef || !messageRef.current) return null;
    
    
    try {

       const currentRange = messageRef.current.currentRange;

      if (!currentRange) return null;

      const messageContainer = currentRange.commonAncestorContainer;
     
      
      const fullText = messageContainer.textContent || messageContainer.innerText || '';
      
      // Calculate absolute position of selection start in the full text
      let absoluteStart = 0;
      const walker = document.createTreeWalker(
        messageContainer,
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

  // Callback from ChatMessage when text is selected or a translated span is clicked.
  // The extra "isTranslated" flag indicates if the selection already has a translation.
  const handleTextSelect = (ref, rect, text, isTranslated = false) => {
    setActiveMessageRef(ref);
    setSelectedText(text);
    setActiveIsTranslated(isTranslated);

    // Compute toolbar position relative to chat container.
    const containerRect = chatContainerRef.current.getBoundingClientRect();
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

  // Toolbar button handlers call the exposed API on the active ChatMessage.
  const handleToolbarTranslate = async (lang) => {
    if (activeMessageRef && activeMessageRef.current) {
      await activeMessageRef.current.handleTranslate(lang);
    }
  };

  const handleToolbarRollback = () => {
    if (activeMessageRef && activeMessageRef.current) {
      activeMessageRef.current.handleRollback();
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
    const sentenceContext = extractSentenceFromSelection(activeMessageRef);
    return addWordToList(text, listId, sentenceContext);
  };

  const handleMoveToList = async (text, sourceListId, targetListId) => {
    if (!text.trim() || sourceListId === targetListId) return null;
    return moveWordBetweenLists(text, sourceListId, targetListId);
  };

  const handleCreateNewList = async (text) => {
    if (!text.trim()) return null;
    
    // Extract sentence context using selection range
    const sentenceContext = extractSentenceFromSelection(activeMessageRef);
    
    return createNewListWithWord(text, null, sentenceContext);
  };

  // Group messages into tiles by note they relate to
  const groupTilesByNote = () => {
    const tileGroups = {};
    let currentNoteId = null;
    
    // Iterate through messages to find notes and questions
    messages.forEach((msg) => {
      if (msg.is_note) {
        // This is a note - track its ID
        currentNoteId = msg.id;
        if (!tileGroups[currentNoteId]) {
          tileGroups[currentNoteId] = [];
        }
      } else {
        // This is a question following a note
        // Create tile from question and answer pair
        const tile = {
            id: msg.id,
            noteId: currentNoteId,
            title: "question",
            content: msg.content,
            state: 'ready',
            expanded: false,
            createdAt: msg.created_at,
            error: null
          };
        tileGroups[currentNoteId].push(tile);
      }
    });
    
    return tileGroups;
  };

  // Send question about a note
  const handleSendQuestion = async (questionText, noteId) => {
    if (!questionText.trim() || !chatId || !onSendQuestion) return;

    try {
      // Call the parent component's send question handler
      await onSendQuestion(questionText, noteId);
    } catch (error) {
      console.error('Failed to send question:', error);
      // Handle error - could show a toast notification
    }
  };

  // Retry failed tile - for now just log, as real implementation would need message retry
  const handleRetryTile = async (tileId) => {
    console.log('Retry tile:', tileId);
    // In real implementation, this would retry the question by resending the message
  };

  const tileGroups = groupTilesByNote();

  return (
    <div
      className="chat-window-container"
      ref={chatContainerRef}
    >
      <div className="chat-window">
        {messages.map((msg, index) => {
          if (!messageRefs.current[index]) {
            messageRefs.current[index] = React.createRef();
          }
          if (!msg.is_note) {
            return
          }
          // Get tiles for this message if it's a note, and apply UI states
          const messageTiles = tileGroups[msg.id] || [];
          
          return (
            <ChatMessage
              key={index}
              ref={messageRefs.current[index]}
              msg={msg}
              chatId={chatId}
              tiles={messageTiles}
              onSendQuestion={handleSendQuestion}
              onRetryTile={handleRetryTile}
              onTextSelect={(rect, text, isTranslated) => {
                // Use a timeout to ensure the child event has completed.
                setTimeout(() => handleTextSelect(messageRefs.current[index], rect, text, isTranslated), 0);
              }}
            />
          );
        })}
      </div>

      <ChatToolbar
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

export default ChatWindow;
