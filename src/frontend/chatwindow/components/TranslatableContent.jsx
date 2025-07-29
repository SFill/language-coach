import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTextSelection } from '../../hooks/useTextSelection';
import { useTranslation } from '../../hooks/useTranslation';
import MarkdownContent from './MarkdownContent';

/**
 * Component for content that can be translated
 */
const TranslatableContent = React.forwardRef(({ content, onTextSelect, chatId }, ref) => {
    // Set up translation handling
    const {
        translatedNode,
        setTranslatedNode,
        translateInRange,
        updateTranslation,
        revertTranslation
    } = useTranslation();

    // Handle when a translated span is clicked
    const handleTranslatedClick = useCallback((e) => {
        const target = e.target.closest('span[data-translated]');

        if (!target || target.nodeType !== 1) return;
        
        e.stopPropagation();
        const isTranslated = target.getAttribute('data-translated') === 'true';
        if (isTranslated) {
            e.stopPropagation();
            setTranslatedNode(target);

            const text = target.getAttribute('data-original-text') || target.innerHTML;
            const rect = target.getBoundingClientRect();

            if (onTextSelect) {
                onTextSelect(rect, text, true);
            }
        }
    }, [onTextSelect, setTranslatedNode]);

    // Set up text selection handling
    const { 
        containerRef, 
        currentRange, 
        selectedText, 
        handleSelection,
        checkSelectionWithinContainer
    } = useTextSelection((rect, text, isTranslated) => {
        if (onTextSelect) {
            onTextSelect(rect, text, isTranslated);
        }
    });

    // Expose methods to handle selection and translation to parent via ref
    React.useImperativeHandle(ref, () => ({
        currentRange: currentRange,
        handleTranslate: async (lang) => {
            if (translatedNode) {
                await updateTranslation(translatedNode, lang);
                return;
            }

            if (currentRange && selectedText) {
                await translateInRange(currentRange, selectedText, lang);
            }
        },
        handleRollback: () => {
            if (translatedNode) {
                revertTranslation(translatedNode);
                setTranslatedNode(null);
            }
        },
        // New method for the delegated mouseup handler
        handleGlobalSelection: (e) => {
            handleSelection(e);
        },
        // Expose the check method to determine if selection is in this component
        checkSelectionWithinContainer
    }));

    return (
        <div
            ref={containerRef}
            onClick={handleTranslatedClick}
        >
            <MarkdownContent content={content} chatId={chatId} />
        </div>
    );
});

TranslatableContent.propTypes = {
    content: PropTypes.string.isRequired,
    onTextSelect: PropTypes.func,
    chatId: PropTypes.string
};

TranslatableContent.displayName = 'TranslatableContent';

export default TranslatableContent;