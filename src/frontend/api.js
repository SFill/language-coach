import axios from 'axios';

// Use a base URL that covers the /api/coach prefix.
const API_BASE_URL = import.meta.env.VITE_ENVIRONMENT === 'dev' ? 'http://localhost:8000/api/' : 'http://localhost/api/';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Get Chat List from GET /api/coach/chat/
export const fetchChats = async () => {
  try {
    const response = await api.get(`coach/chat/`);
    return response.data.sort((a, b) => a.id - b.id);
  } catch (error) {
    console.error('Error fetching chats:', error);
    return [];
  }
};

// Get Chat details from GET /api/coach/chat/{id}
export const fetchChatById = async (id) => {
  try {
    const response = await api.get(`coach/chat/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error loading chat:', error);
    return null;
  }
};

// Create a new chat using POST /api/coach/chat
export const createNewChat = async () => {
  try {
    const response = await api.post(`coach/chat`, {
      name: new Date().toLocaleString(),
      history: { content: [] },
    });
    return response.data;
  } catch (error) {
    console.error('Error creating chat:', error);
    return null;
  }
};

// Send a message using POST /api/coach/chat/{id}/message
export const sendMessage = async (chatId, message) => {
  try {
    const response = await api.post(`coach/chat/${chatId}/message`, { message });
    return response.data.chat_bot_message;
  } catch (error) {
    console.error('Error sending message:', error);
    return 'Sorry, something went wrong.';
  }
};


export const translateText = async (text, target) => {
  try {
    const response = await api.post(`translate`, { text, target });
    return response.data.text;
  } catch (error) {
    console.error('Error sending message:', error);
    return 'Sorry, something went wrong.';
  }
};


// Get Chat details from GET /api/words/{word}
export const getWordDefinition = async (word) => {
  try {
    const response = await api.get(`words/${word}`);
    return response.data;
  } catch (error) {
    console.error('Error loading chat:', error);
    return null;
  }
};