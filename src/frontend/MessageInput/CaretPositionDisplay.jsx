import React from 'react';

/**
 * Component to display the current caret position (line/column)
 * 
 * @param {Object} props - Component props
 * @param {Object} props.caretInfo - Current caret position information
 */
const CaretPositionDisplay = ({ caretInfo }) => {
  const { logicalLine, column } = caretInfo;
  
  return (
    <div className="caret-position">
      Ln {logicalLine}, Col {column}
    </div>
  );
};

export default CaretPositionDisplay;