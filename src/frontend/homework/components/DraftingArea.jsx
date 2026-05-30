import React from 'react';
import { DRAFT_SEGMENTS } from '../data/mockData';

/**
 * @param {{ segments: Array<{ text: string, type: string, annotation?: string }> }} props
 */
export default function DraftingArea({ segments = DRAFT_SEGMENTS }) {
  return (
    <section className="hw-draft-section">
      <div className="hw-draft-header">
        <div className="hw-draft-header-left">
          <span className="hw-material-icon">edit_square</span>
          <span className="hw-draft-title">Drafting Area</span>
        </div>
        <div className="hw-toolbar">
          <button className="hw-tool-btn" title="Bold">
            <span className="hw-material-icon">format_bold</span>
          </button>
          <button className="hw-tool-btn" title="Italic">
            <span className="hw-material-icon">format_italic</span>
          </button>
          <button className="hw-tool-btn" title="Bullet List">
            <span className="hw-material-icon">format_list_bulleted</span>
          </button>
          <div className="hw-toolbar-divider" />
          <button className="hw-tool-btn" title="Undo">
            <span className="hw-material-icon">undo</span>
          </button>
        </div>
      </div>

      <div className="hw-editor">
        <div className="hw-editor-content" contentEditable style={{ outline: 'none' }}>
          {segments.map((seg, i) => {
            if (seg.type === 'correct') {
              return (
                <span key={i} className="hw-highlight-correct">
                  {seg.text}
                  <span className="hw-tooltip">{seg.annotation}</span>
                </span>
              );
            }
            if (seg.type === 'suggestion') {
              return (
                <span key={i} className="hw-highlight-suggestion">
                  {seg.text}
                  <span className="hw-tooltip">{seg.annotation}</span>
                </span>
              );
            }
            return <span key={i}>{seg.text}</span>;
          })}
        </div>
      </div>

      <div className="hw-draft-actions">
        <button className="hw-ai-check-btn">
          <span className="hw-material-icon">auto_awesome</span>
          AI Check
        </button>
        <button className="hw-submit-btn">
          <span className="hw-material-icon">send</span>
          Submit
        </button>
      </div>
    </section>
  );
}
