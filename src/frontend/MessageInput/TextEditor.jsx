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
  textareaRef
}) => {
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
      placeholder="Type your message... (Ctrl+B for bold, Ctrl+I for italic)"
      className="vs-code-textarea"
    />
  );
};

export default TextEditor;