import React, { useState } from 'react';
import { DRAFT_SEGMENTS } from '../data/mockData';

export default function DraftingArea({ segments = DRAFT_SEGMENTS }) {
  const [activeTab, setActiveTab] = useState('assignment');

  return (
    <section className="hw-draft-section">
      {/* Tabs Header */}
      <div className="hw-tabs">
        <button
          className={`hw-tab ${activeTab === 'assignment' ? 'hw-tab--active' : ''}`}
          onClick={() => setActiveTab('assignment')}
        >
          Assignment
        </button>
        <button
          className={`hw-tab ${activeTab === 'qa' ? 'hw-tab--active' : ''}`}
          onClick={() => setActiveTab('qa')}
        >
          AI Q&A
        </button>
      </div>

      {/* Editor Toolbar */}
      <div className="hw-toolbar">
        <div className="hw-toolbar-group">
          <button className="hw-tool-btn" title="Bold">
            <span className="hw-material-icon">format_bold</span>
          </button>
          <button className="hw-tool-btn" title="Italic">
            <span className="hw-material-icon">format_italic</span>
          </button>
          <button className="hw-tool-btn" title="Underline">
            <span className="hw-material-icon">format_underlined</span>
          </button>
        </div>
        <div className="hw-toolbar-group">
          <button className="hw-tool-btn" title="Bullet List">
            <span className="hw-material-icon">format_list_bulleted</span>
          </button>
          <button className="hw-tool-btn" title="Numbered List">
            <span className="hw-material-icon">format_list_numbered</span>
          </button>
        </div>
        <div className="hw-toolbar-autosave">
          <span className="hw-autosave-dot" />
          Autosaved
        </div>
      </div>

      {/* Rich Text Editor */}
      <div className="hw-editor">
        <div className="hw-editor-content" contentEditable suppressContentEditableWarning style={{ outline: 'none' }}>
          {segments.map((seg, i) => {
            if (seg.type === 'vocab') {
              return (
                <span key={i} className="hw-vocab-highlight">
                  {seg.text}
                  <span className="hw-vocab-popup" contentEditable={false}>
                    <div className="hw-vocab-popup-header">
                      <span className="hw-vocab-word">{seg.word}</span>
                      <span className="hw-vocab-phonetic">{seg.phonetic}</span>
                    </div>
                    <span className="hw-vocab-definition">{seg.annotation}</span>
                    <button className="hw-vocab-ai-btn">
                      <span className="hw-material-icon">smart_toy</span>
                      Ask AI
                    </button>
                    <div className="hw-vocab-popup-arrow" />
                  </span>
                </span>
              );
            }
            if (seg.type === 'correct') {
              return (
                <span key={i} className="hw-highlight-correct">
                  {seg.text}
                </span>
              );
            }
            if (seg.type === 'suggestion') {
              return (
                <span key={i} className="hw-highlight-suggestion">
                  {seg.text}
                </span>
              );
            }
            return <span key={i}>{seg.text}</span>;
          })}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="hw-draft-footer">
        <span className="hw-word-count">Word count: 87 / 200</span>
        <div className="hw-draft-actions">
          <button className="hw-ai-check-btn">
            <span className="hw-material-icon">neurology</span>
            AI Check
          </button>
          <button className="hw-submit-btn">
            <span className="hw-material-icon">send</span>
            Submit
          </button>
        </div>
      </div>
    </section>
  );
}