import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import ChatToolbar from './ChatToolbar';
import './ChatWindow.css';

const ChatWindow = ({ messages,  onCheckInDictionary }) => {
  const chatContainerRef = useRef(null);
  
  // Create refs for each ChatMessage (using index as key for simplicity)
  const messageRefs = useRef([]);
  
  // Toolbar state: style (including position), active message ref, and whether the selection is translated.
  const [toolbarStyle, setToolbarStyle] = useState({ display: 'none' });
  const [activeMessageRef, setActiveMessageRef] = useState(null);
  const [selectedText, setSelectedText] = useState('');
  const [activeIsTranslated, setActiveIsTranslated] = useState(false);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

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
      display: 'block',
      position: 'absolute',
      top,
      left,
    });
  };

  // Hide toolbar.
  const hideToolbar = () => {
    setToolbarStyle({ display: 'none' });
    setActiveMessageRef(null);
    setSelectedText('');
    setActiveIsTranslated(false);
  };

  // Global click handler on ChatWindow container hides toolbar.
  const handleContainerClick = () => {
    hideToolbar();
  };

  // Toolbar button handlers call the exposed API on the active ChatMessage.
  const handleToolbarTranslate = async (lang) => {
    if (activeMessageRef && activeMessageRef.current) {
      await activeMessageRef.current.handleTranslate(lang);
      // hideToolbar();
    }
  };

  const handleToolbarRollback = () => {
    if (activeMessageRef && activeMessageRef.current) {
      activeMessageRef.current.handleRollback();
      hideToolbar();
    }
  };

  const handleDictionaryLookup = () => {
    console.log('Dictionary lookup for:', selectedText);
    onCheckInDictionary(selectedText)
    // hideToolbar();
  };

  return (
    <div 
      className="chat-window-container" 
      ref={chatContainerRef}
      onClick={handleContainerClick}
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
      {/* ChatToolbar stops propagation so that its clicks don't bubble up. */}
      <ChatToolbar 
        style={toolbarStyle}
        handleTranslate={handleToolbarTranslate}
        handleRollback={handleToolbarRollback}
        showDictionaryButton={() => true}
        checkInDictionary={handleDictionaryLookup}
        showRollback={activeIsTranslated}
      />
    </div>
  );
};

export default ChatWindow;
