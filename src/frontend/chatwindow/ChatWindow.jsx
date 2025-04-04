import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import ChatToolbar from './ChatToolbar';
import './ChatWindow.css';
import { normalizePhrase, areCloseMatches } from '../wordlist/utils';

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

  // Add state for word lists (could be fetched from an API in a real application)
  const [wordLists, setWordLists] = useState([
    {
      id: 1,
      name: 'List A',
      words: [
        { word: 'best', definition: 'Definition of best...' },
        { word: 'run away with someone', definition: 'Definition of run away...' },
      ],
    },
    {
      id: 2,
      name: 'List B',
      words: [
        { word: 'key', definition: 'Definition of key...' },
      ],
    },
  ]);

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
        setIsToolbarVisible(false)
        return
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

  // Word list management functions
  const handleAddToList = (text, listId) => {
    if (!text.trim()) return;

    // Check if the word already exists in any list as an exact match
    const normalizedText = normalizePhrase(text);
    const hasExactMatch = wordLists.some(list =>
      list.words.some(w => normalizePhrase(w.word) === normalizedText)
    );

    // If it's an exact match, don't add it
    if (hasExactMatch) {
      console.log('Word already exists in a list');
      // setIsToolbarVisible(false);
      return;
    }

    setWordLists(lists => lists.map(list => {
      if (list.id === listId) {
        return {
          ...list,
          words: [
            ...list.words,
            {
              word: text.trim(),
              definition: 'Added from chat window',
            },
          ],
        };
      }
      return list;
    }));

    // Hide toolbar after adding
    // setIsToolbarVisible(false);
  };

  const handleMoveToList = (text, sourceListId, targetListId) => {
    if (!text.trim() || sourceListId === targetListId) return;

    // First, find the word in the source list
    let wordToMove = null;
    const normalizedText = normalizePhrase(text);

    setWordLists(lists => {
      // Find the word to move
      const sourceList = lists.find(list => list.id === sourceListId);
      if (sourceList) {
        wordToMove = sourceList.words.find(w =>
          normalizePhrase(w.word) === normalizedText ||
          areCloseMatches(normalizePhrase(w.word), normalizedText)
        );
      }

      if (!wordToMove) {
        wordToMove = { word: text.trim(), definition: 'Moved from another list' };
      }

      // Update the lists
      return lists.map(list => {
        if (list.id === sourceListId) {
          return {
            ...list,
            words: list.words.filter(w =>
              normalizePhrase(w.word) !== normalizedText &&
              !areCloseMatches(normalizePhrase(w.word), normalizedText)
            ),
          };
        }
        if (list.id === targetListId) {
          // Check if the target list already has this word
          const exists = list.words.some(w =>
            normalizePhrase(w.word) === normalizedText ||
            areCloseMatches(normalizePhrase(w.word), normalizedText)
          );

          if (!exists) {
            return {
              ...list,
              words: [...list.words, wordToMove],
            };
          }
        }
        return list;
      });
    });

    // Hide toolbar after moving
    // setIsToolbarVisible(false);
  };

  const handleCreateNewList = (text) => {
    if (!text.trim()) return;

    // Generate a new list ID
    const newListId = Math.max(0, ...wordLists.map(l => l.id)) + 1;

    // Create a new list and add it to wordLists
    const newList = {
      id: newListId,
      name: `Chat List ${newListId}`,
      words: [
        {
          word: text.trim(),
          definition: 'First word in new list',
        }
      ],
    };

    setWordLists([...wordLists, newList]);

    // Hide toolbar after creating new list
    setIsToolbarVisible(false);
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
        wordLists={wordLists}
        onAddToList={handleAddToList}
        onMoveToList={handleMoveToList}
        onCreateNewList={handleCreateNewList}
      />
    </div>
  );
};

export default ChatWindow;