import React from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

/**
 * Component for rendering markdown content
 */
const MarkdownContent = React.memo(({ content }) => {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
      {content}
    </ReactMarkdown>
  );
});

MarkdownContent.propTypes = {
  content: PropTypes.string.isRequired
};

MarkdownContent.displayName = 'MarkdownContent';

export default MarkdownContent;
