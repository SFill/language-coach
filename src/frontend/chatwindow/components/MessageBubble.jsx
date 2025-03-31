import React from 'react';
import PropTypes from 'prop-types';
import styles from './MessageBubble.module.css';

/**
 * Message bubble container component
 */
const MessageBubble = React.memo(({ sender, children }) => {
  return (
    <div className={`${styles.chatMessage} ${styles[sender]}`}>
      {children}
    </div>
  );
});

MessageBubble.propTypes = {
  sender: PropTypes.oneOf(['user', 'bot']).isRequired,
  children: PropTypes.node.isRequired
};

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;