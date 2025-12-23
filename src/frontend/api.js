import axios from 'axios';

// Use a base URL that covers the /api/coach prefix.
const API_BASE_URL = import.meta.env.VITE_ENVIRONMENT === 'dev' ? 'http://localhost:8000/api/' : 'http://localhost/api/';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Get Notes List from GET /api/coach/notes/
export const fetchNotes = async () => {
  try {
    const response = await api.get(`coach/notes/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching notes:', error);
    return [];
  }
};

// ===== Notes API =====
export const updateNoteBlock = async (noteId, noteBlockId, text) => {
  if (noteBlockId === undefined) throw new Error('Missing note block identifier');
  try {
    const response = await api.patch(`coach/notes/${noteId}/block/${noteBlockId}`,
     {
        "block": text,
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating note block:', error);
    return null;
  }
};
export const deleteNoteBlock = async (noteId, noteBlockId) => {
  if (noteBlockId === undefined) throw new Error('Missing note block identifier');
  try {
    const response = await api.delete(`coach/notes/${noteId}/block/${noteBlockId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting note block:', error);
    return null;
  }

};

// Get Note details from GET /api/coach/notes/{id}
export const fetchNoteById = async (id) => {
  try {
    const response = await api.get(`coach/notes/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error loading note:', error);
    return null;
  }
};

// Delete Note at DELETE /api/coach/notes/{id}
export const deleteNote = async (id) => {
  try {
    const response = await api.delete(`coach/notes/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting note:', error);
    return null;
  }
};

// Create a new note using POST /api/coach/notes
export const createNewNote = async () => {
  try {
    const response = await api.post(`coach/notes/`, {
      name: new Date().toLocaleString(),
      history: { content: [] },
    });
    return response.data;
  } catch (error) {
    console.error('Error creating note:', error);
    return null;
  }
};

// Send a note block using POST /api/coach/notes/{id}/block
export const sendNoteBlock = async (noteId, data) => {
  try {
    const response = await api.post(`coach/notes/${noteId}/block`, data);
    return response.data.new_note_blocks;
  } catch (error) {
    console.error('Error sending note block:', error);
    return 'Sorry, something went wrong.';
  }
};

export const translateText = async (text, target) => {
  try {
    const response = await api.post(`translate`, { text, target });
    return response.data.text;
  } catch (error) {
    console.error('Error translating text:', error);
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
      words: list.words.map(w => w.word),
      language: list.language,
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


// Get example sentences for a word
export const fetchSentenceExamples = async (word, language = "en", topN = 5, proficiency = "intermediate") => {
  try {
    const params = {
      language,
      top_n: topN,
      proficiency
    };

    const response = await api.get(`coach/index/words/${encodeURIComponent(word)}`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching sentence examples:', error);
    if (error.response && error.response.status === 404) {
      // Special handling for 404 (no sentences found)
      return [];
    }
    throw error; // Re-throw for component-level handling
  }
};

// ========== Note Images API Methods ==========

// Upload an image to a note
export const uploadNoteImage = async (noteId, file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post(`coach/notes/${noteId}/images`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

// Get all images for a note
export const fetchNoteImages = async (noteId) => {
  try {
    const response = await api.get(`coach/notes/${noteId}/images`);
    return response.data;
  } catch (error) {
    console.error('Error fetching note images:', error);
    return [];
  }
};

// Delete an image from a note
export const deleteNoteImage = async (noteId, imageId) => {
  try {
    const response = await api.delete(`coach/notes/${noteId}/images/${imageId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
};

// Get image file URL
export const getNoteImageUrl = (noteId, imageId) => {
  return `${API_BASE_URL}coach/notes/${noteId}/images/${imageId}/file`;
};

// ========== Q/A Tiles Mock API Methods ==========

// Mock function to simulate API delay and potential errors
const mockApiCall = async (responseData, delay = 1000) => {
  await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 2000));
  
  // 15% chance of error as specified in requirements
  if (Math.random() < 0.15) {
    throw new Error('Network error occurred');
  }
  
  return responseData;
};

// Send a question about a note using POST /api/coach/notes/{id}/block
export const sendQuestion = async (noteId, question) => {
  try {
    // For now, use mock data as specified in requirements
    // Return both user question and bot response as the existing sendNoteBlock does
    const userNoteBlock = {
      id: Date.now(),
      sender: "user",
      content: question,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_note: false
    };

    const botResponse = {
      id: Date.now() + 1,
      sender: "bot",
      content: `This is a mock answer to the question: "${question}". In a real implementation, this would be the AI assistant's response to your question about the note.`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_note: false
    };

    // Simulate API delay and potential errors
    await mockApiCall([userNoteBlock, botResponse]);
    
    return [userNoteBlock, botResponse];
  } catch (error) {
    console.error('Error sending question:', error);
    throw error;
  }
};

// Real API call (commented out for now, will be used when backend is ready)
/*
export const sendQuestion = async (noteId, question) => {
  try {
    const response = await api.post(`coach/notes/${noteId}/block`, {
      message: question,
      is_note: false,
      image_ids: []
    });
    return response.data;
  } catch (error) {
    console.error('Error sending question:', error);
    throw error;
  }
};
*/