import React, { useState, useRef, useEffect } from 'react';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const chatContainerRef = useRef(null);

  // Function to handle sending a message
  const handleSend = async () => {
    if (!input.trim()) return;

    // Append the user's message
    const userMessage = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // Simulate a reply from the language coach
    try {
      const response = await simulateLanguageCoachReply(input);
      const botMessage = { sender: 'bot', text: response };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      // Handle errors gracefully
      const errorMessage = { sender: 'bot', text: 'Sorry, something went wrong. Please try again.' };
      setMessages((prev) => [...prev, errorMessage]);
      console.error('Error generating response:', error);
    }
  };

  // Simulated API call for the language coach's reply
  const simulateLanguageCoachReply = (userInput) => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate an occasional error (10% chance)
        if (Math.random() < 0.1) {
          reject(new Error('Simulated API error'));
        } else {
          resolve(`Coach: I noticed you said "${userInput}". Consider using more descriptive adjectives to enhance your expression!`);
        }
      }, 1000); // 1-second delay
    });
  };

  // Auto-scroll to the bottom when new messages are added
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="main-container">
      <div className="app-container">
        <div className="chat-container" ref={chatContainerRef}>
          {messages.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.sender}`}>
              {msg.text}
            </div>
          ))}
        </div>
        <div className="input-container">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSend();
              }
            }}
            placeholder="Type your message here..."
          />
          <button onClick={handleSend}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default App;
