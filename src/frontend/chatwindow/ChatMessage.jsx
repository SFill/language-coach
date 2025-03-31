import React from 'react';
import PropTypes from 'prop-types';
import MessageBubble from './components/MessageBubble';
import ExpandableContent from './components/ExpandableContent';
import TranslatableContent from './components/TranslatableContent';
import './ChatMessage.css';

const FOLD_THRESHOLD = 300; // Character threshold to consider a message long

/**
 * Complete chat message component
 */
const ChatMessage = React.forwardRef(({ msg, onTextSelect }, ref) => {
  const isBot = msg.sender === 'bot';
  const isLong = msg.text.length > FOLD_THRESHOLD;

  return (
    <MessageBubble sender={msg.sender}>
      {isBot ? (
        <ExpandableContent isLong={isLong}>
          <TranslatableContent 
            ref={ref}
            content={msg.text}
            onTextSelect={onTextSelect}
          />
        </ExpandableContent>
      ) : (
        <TranslatableContent 
          ref={ref}
          content={msg.text}
          onTextSelect={onTextSelect}
        />
      )}
    </MessageBubble>
  );
});

ChatMessage.propTypes = {
  msg: PropTypes.shape({
    sender: PropTypes.oneOf(['user', 'bot']).isRequired,
    text: PropTypes.string.isRequired
  }).isRequired,
  onTextSelect: PropTypes.func
};

ChatMessage.displayName = 'ChatMessage';

export default React.memo(ChatMessage);
