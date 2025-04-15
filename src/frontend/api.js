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
    return response.data;
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

// Delete Chat at DELETE /api/coach/chat/{id}
export const deleteChat = async (id) => {
  try {
    const response = await api.delete(`coach/chat/${id}`);
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
    const response = await api.post(`coach/chat/${chatId}/message`, message);
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

// Get word definition from GET /api/words/{word}
export const getWordDefinition = (word, language = "en", includeConjugations = false) => {
  const params = {
    language,
    include_conjugations: includeConjugations
  };

  return api.get(`words/${word}`, { params }).then((res) => res.data);
};

// ========== Wordlist API Methods ==========

// Get all wordlists from GET /api/wordlist/
export const fetchWordlists = async (language = null) => {
  const params = {
    language,
  };
  try {
    const response = await api.get(`wordlist/`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching wordlists:', error);
    return [];
  }
};

// Get a specific wordlist by ID from GET /api/wordlist/{id}
export const fetchWordlistById = async (id) => {
  try {
    const response = await api.get(`wordlist/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error loading wordlist:', error);
    return null;
  }
};

// Create a new wordlist using POST /api/wordlist/
export const createWordlist = async (wordlistData) => {
  try {
    const response = await api.post(`wordlist/`, wordlistData);
    return response.data;
  } catch (error) {
    console.error('Error creating wordlist:', error);
    return null;
  }
};

// Update a wordlist using post /api/wordlist/{id}
export const updateWordlist = async (id, wordlistData) => {
  try {
    const response = await api.post(`wordlist/${id}`, wordlistData);
    return response.data;
  } catch (error) {
    console.error('Error updating wordlist:', error);
    return null;
  }
};

// Delete a wordlist using DELETE /api/wordlist/{id}
export const deleteWordlist = async (id) => {
  try {
    const response = await api.delete(`wordlist/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting wordlist:', error);
    return null;
  }
};

// Update wordlists before page refresh using sendBeacon
export const updateWordListsBeforeRefresh = (dirtyLists) => {
  if (!dirtyLists || dirtyLists.length === 0) return;

  dirtyLists.forEach(list => {
    const updateData = {
      name: list.name,
      words: list.words.map(w => w.word)
    };

    // Prepare the data as JSON
    const blob = new Blob(
      [JSON.stringify(updateData)],
      { type: 'application/json' }
    );

    // Use sendBeacon which is designed for page unload scenarios
    const endpoint = `${API_BASE_URL}wordlist/${list.id}`;
    navigator.sendBeacon(endpoint, blob);
    console.log("updates " + list)
  });

  console.log(`Synced ${dirtyLists.length} lists on page unload`);
};