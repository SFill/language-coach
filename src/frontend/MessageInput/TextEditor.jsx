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

  const handlePaste = async (event) => {
    console.log('Paste event detected');
    
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    // Check for images in clipboard
    const items = Array.from(clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    
    if (imageItems.length > 0 && onImageDrop) {
      // Handle image paste
      event.preventDefault();
      
      const imageFiles = [];
      for (const item of imageItems) {
        const file = item.getAsFile();
        if (file) {
          // Create a proper File object with a name
          const renamedFile = new File([file], `pasted-image-${Date.now()}.${file.type.split('/')[1]}`, {
            type: file.type
          });
          imageFiles.push(renamedFile);
        }
      }
      
      if (imageFiles.length > 0) {
        console.log('Pasting images:', imageFiles);
        // Call the image attachment handler
        if (onImageDrop && typeof onImageDrop === 'function') {
          onImageDrop(imageFiles);
        }
      }
    } else {
      // Handle text paste - let browser handle normally
      const textData = clipboardData.getData('text/plain');
      console.log('Pasting text:', textData);
      // Don't prevent default for text paste
    }
  };

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
      onPaste={handlePaste}
      placeholder="Type your message... (Ctrl+B for bold, Ctrl+I for italic)"
      className="vs-code-textarea"
      autoFocus
    />
  );
};

export default TextEditor;