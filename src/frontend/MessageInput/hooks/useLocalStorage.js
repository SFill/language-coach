import { useState, useEffect } from 'react';

/**
 * Hook to persist state to localStorage
 * 
 * @param {string} key - localStorage key
 * @param {any} initialValue - Default value if nothing in localStorage
 * @returns {Array} [storedValue, setValue] - State and setter function
 */
const useLocalStorage = (key, initialValue) => {
  // State to store our value
  const [storedValue, setStoredValue] = useState(() => {
    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      // Parse stored json or return initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // If error, return initialValue
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });

  // Update localStorage when the state changes
  useEffect(() => {
    try {
      // Save to local storage
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      // Handle possible errors
      console.error('Error writing to localStorage:', error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
};

export default useLocalStorage;