import type { CSSProperties, Ref } from 'react';

type FeedbackType = 'suggestion' | 'vocab' | 'grammar' | 'wordlist';

export interface FeedbackTooltipData {
  type: FeedbackType;
  annotation?: string;
  word?: string;
  phonetic?: string;
  translation?: string;
  examplePhrase?: string;
}

interface FeedbackTooltipProps {
  data: FeedbackTooltipData | null;
  setFloating: Ref<HTMLDivElement>;
  style: CSSProperties;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

// Floating tooltip showing a highlight's annotation. Positioning is handled by
// @floating-ui/react (portaled to <body> with strategy:'fixed'), so it is no
// longer clipped by the .hw-editor scroll container.
export default function FeedbackTooltip({ data, setFloating, style, onMouseEnter, onMouseLeave }: FeedbackTooltipProps) {
  if (!data) return null;

  const typeConfig = {
    suggestion: { label: '✏️ Suggestion', accentClass: 'hw-feedback-tooltip--suggestion' },
    vocab:      { label: '📖 Vocabulary', accentClass: 'hw-feedback-tooltip--vocab' },
    grammar:    { label: '📐 Grammar', accentClass: 'hw-feedback-tooltip--grammar' },
    wordlist:   { label: '📖 Vocabulary', accentClass: 'hw-feedback-tooltip--vocab' },
  };
  const config = typeConfig[data.type] || typeConfig.suggestion;

  return (
    <div
      ref={setFloating}
      style={style}
      className={`hw-feedback-tooltip ${config.accentClass}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="hw-feedback-tooltip-label">{config.label}</div>
      {data.type === 'suggestion' && data.annotation && (
        <div className="hw-feedback-tooltip-body">{data.annotation}</div>
      )}
      {data.type === 'vocab' && (
        <div className="hw-feedback-tooltip-body">
          {data.word && <strong>{data.word}</strong>}
          {data.phonetic && <span className="hw-feedback-tooltip-phonetic">{data.phonetic}</span>}
          {data.annotation && <span> — {data.annotation}</span>}
        </div>
      )}
      {data.type === 'grammar' && data.annotation && (
        <div className="hw-feedback-tooltip-body">{data.annotation}</div>
      )}
      {data.type === 'wordlist' && (
        <div className="hw-feedback-tooltip-body">
          {data.word && <strong>{data.word}</strong>}
          {data.translation && <span> — {data.translation}</span>}
          {data.examplePhrase && (
            <div className="hw-feedback-tooltip-phonetic">{data.examplePhrase}</div>
          )}
        </div>
      )}
    </div>
  );
}