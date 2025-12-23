import React from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { getNoteImageUrl } from '../../api';

/**
 * Component for rendering markdown content with image support
 */
const MarkdownContent = React.memo(({ content, noteId }) => {
  // Process content to replace image references with actual images
  const processedContent = React.useMemo(() => {
    if (!noteId) return content;
    
    // Replace [Image: filename] with markdown image syntax
    // and @image:id references with images
    let processed = content;
    
    // Handle @image:id references (these should be converted by backend already)
    // But if any slip through, convert them to placeholder
    processed = processed.replace(/@image:(\d+)/g, (match, imageId) => {
      return `![Image](${getNoteImageUrl(noteId, imageId)} "Image ${imageId}")`;
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
