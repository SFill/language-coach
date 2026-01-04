import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import ReactDOM from 'react-dom';
import { fetchNoteImages, deleteNoteImage, uploadNoteImage, getNoteImageUrl } from '../api';
import './NoteImagesList.css';

const NoteImagesList = forwardRef(({ noteId, onImageUpload, onImageReference, noteBlocks = [], onImageClick, activeImageIds = [], onToggleCollapse }, ref) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [expandedImageId, setExpandedImageId] = useState(null);
  const [expandedImageHeight, setExpandedImageHeight] = useState(0);
  const expandedImageRef = useRef(null);

  useEffect(() => {
    if (noteId) {
      loadImages();
    }
  }, [noteId]);

  // Paste handling moved to NoteWindow as the single handler

  const loadImages = async () => {
    setLoading(true);
    try {
      const noteImages = await fetchNoteImages(noteId);
      setImages(noteImages);
    } catch (error) {
      console.error('Error loading note images:', error);
    } finally {
      setLoading(false);
    }
  };

  // Expose loadImages method to parent component
  useImperativeHandle(ref, () => ({
    loadImages
  }));

  const handleFileUpload = async (files) => {
    if (!files.length || !noteId) return;

    setUploading(true);
    try {
      for (const file of files) {
        const uploadedImage = await uploadNoteImage(noteId, file);
        setImages(prev => [uploadedImage, ...prev]);
        if (onImageUpload) {
          onImageUpload(uploadedImage);
        }
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Error uploading images. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    handleFileUpload(files);
    event.target.value = ''; // Reset input
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    
    const files = Array.from(event.dataTransfer.files).filter(
      file => file.type.startsWith('image/')
    );
    
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleDeleteImage = async (imageId) => {
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      await deleteNoteImage(noteId, imageId);
      setImages(prev => prev.filter(img => img.id !== imageId));
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Error deleting image. Please try again.');
    }
  };

  const handleImageClick = (image, event) => {
    // Check if clicking on expand button
    if (event.target.closest('.expand-image-button')) {
      return; // Let the expand button handle it
    }
    
    // New behavior: scroll to note containing this image
    if (onImageClick) {
      onImageClick(image.id);
    }
    // Keep old behavior for backward compatibility
    if (onImageReference) {
      onImageReference(image);
    }
  };

  const handleExpandImage = (imageId, event) => {
    event.stopPropagation();
    // Toggle expansion - if already expanded, collapse it
    setExpandedImageId(expandedImageId === imageId ? null : imageId);
  };

  // Handle ESC key to close expanded image
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && expandedImageId) {
        setExpandedImageId(null);
        setExpandedImageHeight(0);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedImageId]);

  // Measure expanded image height when it loads
  useEffect(() => {
    if (expandedImageRef.current) {
      const updateHeight = () => {
        const height = expandedImageRef.current.offsetHeight;
        setExpandedImageHeight(height);
      };
      
      // Update height after image loads
      const img = expandedImageRef.current;
      if (img.complete) {
        updateHeight();
      } else {
        img.addEventListener('load', updateHeight);
        return () => img.removeEventListener('load', updateHeight);
      }
    }
  }, [expandedImageId]);

  const handleImageDragStart = (event, image) => {
    event.dataTransfer.setData('text/plain', `@image:${image.id}`);
    event.dataTransfer.effectAllowed = 'copy';
  };

  if (!noteId) {
    return (
      <div className="note-images-list">
        <div className="no-note-message">
          Select a note to view images
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="note-images-list">
        <div className="note-images-header">
          <h3>Exercise Images</h3>
          <div className="upload-controls">
            <label className="upload-button" htmlFor="image-upload">
              📎 Upload
            </label>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            {onToggleCollapse && (
              <button
                className="collapse-button"
                onClick={onToggleCollapse}
                title="Hide images panel"
              >
                ◀
              </button>
            )}
          </div>
        </div>

      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {uploading && (
          <div className="uploading-indicator">
            Uploading images...
          </div>
        )}

        {loading ? (
          <div className="loading">Loading images...</div>
        ) : images.length === 0 ? (
          <div className="no-images">
            <p>No exercise images</p>
            <p className="hint">Images linked to notes will appear here</p>
          </div>
        ) : (
          <div
            className="images-grid"
            style={expandedImageHeight > 0 ? { paddingTop: `${expandedImageHeight + 32}px` } : {}}
          >
            {images.map((image) => {
              const isActive = activeImageIds.includes(image.id);
              const isExpanded = expandedImageId === image.id;
              return (
                <div
                  key={image.id}
                  className={`image-item${isActive ? ' image-item--active' : ''}`}
                  draggable={!isExpanded}
                  onDragStart={(e) => handleImageDragStart(e, image)}
                  onClick={(e) => handleImageClick(image, e)}
                >
                  <img
                    src={getNoteImageUrl(noteId, image.id)}
                    alt={image.original_filename}
                    className="image-thumbnail"
                  />
                  <button
                    className="expand-image-button"
                    onClick={(e) => handleExpandImage(image.id, e)}
                    title="Expand to full size"
                  >
                    🔍
                  </button>
                  <button
                    className="delete-image"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteImage(image.id);
                    }}
                    title="Delete image"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>

    {/* Render expanded image via Portal to bypass sticky positioning */}
    {expandedImageId && ReactDOM.createPortal(
      <div className="image-expanded-overlay">
        <div className="image-expanded-container">
          <img
            ref={expandedImageRef}
            src={getNoteImageUrl(noteId, expandedImageId)}
            alt="Expanded view"
            className="image-expanded"
          />
          <button
            className="image-expanded-close"
            onClick={() => {
              setExpandedImageId(null);
              setExpandedImageHeight(0);
            }}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>,
      document.body
    )}
  </>
  );
});

export default NoteImagesList;
