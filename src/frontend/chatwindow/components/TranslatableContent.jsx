import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTextSelection } from '../../hooks/useTextSelection';
import { useTranslation } from '../../hooks/useTranslation';
import MarkdownContent from './MarkdownContent';

/**
 * Component for content that can be translated
 */
const TranslatableContent = React.forwardRef(({ content, onTextSelect }, ref) => {
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
        e.stopPropagation();
        const target = e.target.closest('span[data-translated]');

        if (!target || target.nodeType !== 1) return;

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
    const { containerRef, currentRange, selectedText, handleSelection } =
        useTextSelection((rect, text, isTranslated) => {
            if (onTextSelect) {
                onTextSelect(rect, text, isTranslated);
            }
        });

    // Expose translation methods to parent via ref
    React.useImperativeHandle(ref, () => ({
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
        }
    }));

    return (
        <div
            ref={containerRef}
            onTouchEnd={handleSelection}
            onClick={handleTranslatedClick}
        >
            <MarkdownContent content={content} />
        </div>
    );
});

TranslatableContent.propTypes = {
    content: PropTypes.string.isRequired,
    onTextSelect: PropTypes.func
};

TranslatableContent.displayName = 'TranslatableContent';

export default TranslatableContent;