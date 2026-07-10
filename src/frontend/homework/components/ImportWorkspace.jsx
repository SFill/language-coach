import React, { useState, useCallback, useRef } from 'react';
import { parseClipboardHTML, imageSrcToFile } from '../utils/importPaste';
import { importAssignments } from '../utils/importAssignments';

export default function ImportWorkspace({ onPasteText, onImportComplete }) {
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [segments, setSegments] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // Handle paste event inside the contentEditable div
  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');

    let parsed = [];
    if (html) {
      parsed = parseClipboardHTML(html);
    }
    // Fallback: if no HTML segments found, use plain text
    if (parsed.length === 0 && text?.trim()) {
      parsed = [{ type: 'exercise', text: text.trim(), images: [] }];
    }

    if (parsed.length > 0) {
      setSegments(parsed);
    }
  }, []);

  // Import parsed segments as assignments
  const handleImport = useCallback(async () => {
    if (segments.length === 0) return;
    setIsImporting(true);
    setError(null);

    try {
      const result = await importAssignments(segments);
      if (onImportComplete) {
        onImportComplete(result.noteId);
      }
    } catch (err) {
      console.error('Import failed:', err);
      setError('Failed to import. Please try again.');
    } finally {
      setIsImporting(false);
    }
  }, [segments, onImportComplete]);

  // Import plain text (from textarea or drag-drop)
  const handlePlainTextImport = useCallback((text) => {
    if (!text.trim()) return;
    // If we have onPasteText (DraftingArea flow), use it directly
    if (onPasteText) {
      onPasteText(text);
      return;
    }
    // Otherwise, set as a text exercise for the modal flow
    setSegments([{ type: 'exercise', text: text.trim(), images: [] }]);
  }, [onPasteText]);

  const handleCancel = () => {
    setShowPasteModal(false);
    setSegments([]);
    setError(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Drag-and-drop for .txt files
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result;
          if (typeof text === 'string' && text.trim()) {
            handlePlainTextImport(text);
          }
        };
        reader.readAsText(file);
        return;
      }
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const src = event.target?.result;
          if (typeof src === 'string') {
            setSegments(prev => [...prev, { type: 'exercise', text: '', images: [src] }]);
          }
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  }, [handlePlainTextImport]);

  // Preview of parsed segments
  const renderPreview = () => (
    <div className="hw-import-preview">
      <h4 className="hw-import-preview-title">Detected {segments.length} exercise{segments.length !== 1 ? 's' : ''}</h4>
      <div className="hw-import-preview-list">
        {segments.map((ex, i) => (
          <div key={i} className="hw-import-preview-item hw-import-preview-item--exercise">
            <span className="hw-import-preview-type">
              {ex.images.length ? '🖼 Exercise' : '📝 Exercise'}
            </span>
            {ex.text && (
              <p className="hw-import-preview-content">
                {ex.text.length > 120 ? ex.text.slice(0, 120) + '…' : ex.text}
              </p>
            )}
            {ex.images[0] && (
              <img src={ex.images[0]} alt="" className="hw-import-preview-thumb" />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className="hw-import-workspace"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Cloud upload icon */}
      <div className="hw-import-icon-wrap">
        <span className="hw-material-icon" style={{ fontSize: 48, color: 'var(--hw-primary)' }}>
          cloud_upload
        </span>
      </div>

      {/* Heading + description */}
      <div className="hw-import-text">
        <h2 className="hw-import-title">Import your work</h2>
        <p className="hw-import-desc">
          Paste text or upload a document to get started. We'll help you analyze and refine your writing.
        </p>
      </div>

      {/* Paste Text button */}
      <button className="hw-paste-btn" onClick={() => setShowPasteModal(true)} disabled={isImporting}>
        <span className="hw-material-icon">content_paste</span>
        Paste Text
      </button>

      {/* Drag-and-drop zone */}
      <div className={`hw-drop-zone${dragOver ? ' hw-drop-zone--active' : ''}`}>
        <span className="hw-material-icon hw-drop-zone-icon">upload_file</span>
        <p className="hw-drop-zone-label">Drag and drop Word or PDF files here</p>
      </div>

      {/* Paste modal */}
      {showPasteModal && (
        <div className="hw-paste-modal-overlay" onKeyDown={handleKeyDown}>
          <div className="hw-paste-modal">
            <h3 className="hw-paste-modal-title">Paste your work</h3>

            {segments.length === 0 ? (
              /* Paste area — contentEditable to capture rich HTML */
              <div
                className="hw-paste-area"
                contentEditable
                suppressContentEditableWarning
                onPaste={handlePaste}
                data-placeholder="Paste content here (Ctrl+V)..."
              />
            ) : (
              /* Preview of detected segments */
              renderPreview()
            )}

            {error && <p className="hw-import-error">{error}</p>}

            <div className="hw-paste-modal-actions">
              <button className="hw-paste-cancel-btn" onClick={handleCancel} disabled={isImporting}>
                Cancel
              </button>
              {segments.length > 0 && (
                <button className="hw-paste-import-btn" onClick={handleImport} disabled={isImporting}>
                  {isImporting ? 'Importing…' : `Import ${segments.length} exercise${segments.length !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}