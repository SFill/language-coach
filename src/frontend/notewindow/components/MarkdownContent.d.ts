import type { FC } from 'react';

declare const MarkdownContent: FC<{
  content: string;
  noteId?: string | number;
}>;

export default MarkdownContent;