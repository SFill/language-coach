import React from 'react';

/**
 * Core text editor component with VS Code-like behavior
 * 
 * @param {Object} props - Component props
 * @param {string} props.value - Current text value
 * @param {Function} props.onChange - Text change handler
 * @param {Function} props.onSelect - Text selection handler
 * @param {Function} props.onKeyDown - Keyboard event handler
 * @param {Function} props.onKeyUp - Keyboard up event handler
 * @param {Function} props.onMouseUp - Mouse up event handler
 * @param {Function} props.onWheel - Wheel event handler
 * @param {Function} props.onScroll - Scroll event handler
 * @param {Function} props.onFocus - Focus event handler
 * @param {Function} props.onBlur - Blur event handler
 * @param {Object} props.textareaRef - Ref for the textarea
 * @param {Function} props.onImageDrop - Handler for dropped image references
 */
const TextEditor = ({
  value,
  onChange,
  onSelect,
  onKeyDown,
  onKeyUp,
  onMouseUp,
  onWheel,
  onScroll,
  onFocus,
  onBlur,
  textareaRef,
  onImageDrop
}) => {
  const handleDrop = (event) => {
    event.preventDefault();
    
    // Get the dropped data
    const droppedText = event.dataTransfer.getData('text/plain');
    
    // Check if it's an image reference
    if (droppedText.startsWith('@image:') && onImageDrop) {
      const textarea = textareaRef.current;
      if (textarea) {
        const cursorPosition = textarea.selectionStart;
        const newValue = value.slice(0, cursorPosition) + droppedText + ' ' + value.slice(cursorPosition);
        
        // Trigger the change event with the new value
        const syntheticEvent = {
          target: {
            value: newValue
          }
        };
        onChange(syntheticEvent);
        
        // Set cursor position after the inserted text
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = cursorPosition + droppedText.length + 1;
          textarea.focus();
        }, 0);
      }
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  // Paste handling moved to NoteWindow (single source of truth)

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      onSelect={onSelect}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onMouseUp={onMouseUp}
      onWheel={onWheel}
      onScroll={onScroll}
      onFocus={onFocus}
      onBlur={onBlur}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      // onPaste handled globally in NoteWindow
      placeholder="Type your message... (Ctrl+B for bold, Ctrl+I for italic)"
      className="vs-code-textarea"
      autoFocus
    />
  );
};

export default TextEditor;
