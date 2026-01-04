import React from 'react';
import PropTypes from 'prop-types';
import styles from './MessageBubble.module.css';

/**
 * Message bubble container component
 */
const MessageBubble = React.memo(({ sender, children }) => {
  return (
    <div className={`${styles.noteMessage}`}>
      {children}
    </div>
  );
});

MessageBubble.propTypes = {
  children: PropTypes.node.isRequired
};

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;