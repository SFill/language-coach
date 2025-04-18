import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import ChatToolbar from './ChatToolbar';
import './ChatWindow.css';
import { useWordlist } from '../wordlist/WordlistContext';

const ChatWindow = ({ messages, onCheckInDictionary }) => {
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

  // Wordlist management handlers
  const handleAddToList = async (text, listId) => {
    if (!text.trim()) return null;
    return addWordToList(text, listId);
  };

  const handleMoveToList = async (text, sourceListId, targetListId) => {
    if (!text.trim() || sourceListId === targetListId) return null;
    return moveWordBetweenLists(text, sourceListId, targetListId);
  };

  const handleCreateNewList = async (text) => {
    if (!text.trim()) return null;
    return createNewListWithWord(text);
  };

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
          return (
            <ChatMessage
              key={index}
              ref={messageRefs.current[index]}
              msg={msg}
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