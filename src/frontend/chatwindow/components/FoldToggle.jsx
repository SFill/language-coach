import React from 'react';
import downArrow from '../../assets/down-arrow.png';
import rightArrow from '../../assets/right-arrow.png';
import './FoldToggle.css';

const FoldToggle = ({ isExpanded, onClick }) => {
    return (
        <div className="fold-toggle" onClick={onClick}>
            <img
                src={isExpanded ? downArrow : rightArrow}
                alt={isExpanded ? 'Collapse' : 'Expand'}
                className="fold-toggle-icon"
            />
        </div>
    );
};

export default FoldToggle;
