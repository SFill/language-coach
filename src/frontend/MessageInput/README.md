# MessageInput Component

A refactored implementation of the MessageInput component with VS Code-like behavior.

## Component Structure
MessageInput/
    index.jsx                   # Main component that composes everything
    TextEditor.jsx              # Core text editing functionality
    SelectionToolbar.jsx        # Handles selected text and actions
    CaretPositionDisplay.jsx    # Line/column display component
    hooks/
    useCaretTracking.js       # Tracks caret position
    useScrollBehavior.js      # VS Code-like scrolling
    useKeyboardShortcuts.js   # Keyboard shortcut handling
    useTextSelection.js       # Selection state management
    useLocalStorage.js        # Local storage persistence


## Key Features

- **Single Responsibility Principle**: Each component and hook has a clear, focused responsibility
- **Improved Maintainability**: The codebase is now easier to maintain with smaller, focused pieces
- **Better Code Organization**: Logic is separated from UI
- **Reusability**: Hooks can be reused across different components
- **Testability**: Smaller components and hooks are easier to test

## Usage

```jsx
import MessageInput from './components/MessageInput';

function App() {
  const handleSend = (text, isNote) => {
    console.log('Sending:', text, isNote ? 'as note' : 'as question');
    // Process the message here
  };

  return (
    <div className="app">
      <MessageInput onSend={handleSend} />
    </div>
  );
}