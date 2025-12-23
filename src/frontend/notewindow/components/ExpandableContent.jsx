import React, { useState } from 'react';
import PropTypes from 'prop-types';
import FoldToggle from './FoldToggle';
import styles from './ExpandableContent.module.css';

/**
 * Component for expandable/collapsible content
 */
const ExpandableContent = React.memo(({ children, isLong, maxHeight = '100px' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const toggleExpanded = (e) => {
    e.stopPropagation();
    setIsExpanded(prev => !prev);
  };
  
  // If content is not long, just render it normally
  if (!isLong) {
    return children;
  }
  
  return (
    <>
      <FoldToggle isExpanded={isExpanded} onClick={toggleExpanded} />
      <div 
        className={styles.expandableContainer}
        style={
          !isExpanded 
            ? { maxHeight, overflow: 'hidden', position: 'relative' } 
            : {}
        }
      >
        {children}
        {!isExpanded && <div className={styles.foldGradient}></div>}
      </div>
    </>
  );
});

ExpandableContent.propTypes = {
  children: PropTypes.node.isRequired,
  isLong: PropTypes.bool.isRequired,
  maxHeight: PropTypes.string
};

ExpandableContent.displayName = 'ExpandableContent';

export default ExpandableContent;