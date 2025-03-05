import React, { useState } from 'react';
import './MessageInput.css';

const MessageInput = ({ onSend }) => {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim()) {
      onSend(input);
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    // When pressing Enter without Shift, send the message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent newline insertion
      handleSend();
    }
  };

  return (
    <div className="message-input">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        rows={3} // Adjust as needed
      />
      <button onClick={handleSend}>Send</button>
    </div>
  );
};

export default MessageInput;
