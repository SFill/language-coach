import React from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

/**
 * Component for rendering markdown content with image support
 */
const MarkdownContent = React.memo(({ content, noteId }) => {
  // Process content to replace image references with text badges
  const processedContent = React.useMemo(() => {
    if (!noteId) return content;
    
    // Replace @image:id references with text badge instead of rendering images
    // Images are now displayed in the left column, so we just show a reference badge
    let processed = content;
    
    // Convert @image:id to a text badge "📎 Image"
    processed = processed.replace(/@image:(\d+)/g, (match,imageId) => {
      return `📎 Image ${1}`;
    });

    return processed;
  }, [content, noteId]);

  return (
    <ReactMarkdown 
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        img: ({ src, alt, title, ...props }) => (
          <img
            src={src}
            alt={alt}
            title={title}
            style={{
              maxWidth: '100%',
              height: 'auto',
              borderRadius: '8px',
              border: '1px solid #e9ecef',
              margin: '0.5rem 0'
            }}
            {...props}
          />
        )
      }}
    >
      {processedContent}
    </ReactMarkdown>
  );
});

MarkdownContent.propTypes = {
  content: PropTypes.string.isRequired,
  noteId: PropTypes.string
};

MarkdownContent.displayName = 'MarkdownContent';

export default MarkdownContent;
