import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { fetchChatImages, deleteChatImage, uploadChatImage, getChatImageUrl } from '../api';
import './ChatImagesList.css';

const ChatImagesList = forwardRef(({ chatId, onImageUpload, onImageReference }, ref) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (chatId) {
      loadImages();
    }
  }, [chatId]);

  const loadImages = async () => {
    setLoading(true);
    try {
      const chatImages = await fetchChatImages(chatId);
      setImages(chatImages);
    } catch (error) {
      console.error('Error loading images:', error);
    } finally {
      setLoading(false);
    }
  };

  // Expose loadImages method to parent component
  useImperativeHandle(ref, () => ({
    loadImages
  }));

  const handleFileUpload = async (files) => {
    if (!files.length || !chatId) return;

    setUploading(true);
    try {
      for (const file of files) {
        const uploadedImage = await uploadChatImage(chatId, file);
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
      await deleteChatImage(chatId, imageId);
      setImages(prev => prev.filter(img => img.id !== imageId));
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Error deleting image. Please try again.');
    }
  };

  const handleImageClick = (image) => {
    if (onImageReference) {
      onImageReference(image);
    }
  };

  const handleImageDragStart = (event, image) => {
    event.dataTransfer.setData('text/plain', `@image:${image.id}`);
    event.dataTransfer.effectAllowed = 'copy';
  };

  if (!chatId) {
    return (
      <div className="chat-images-list">
        <div className="no-chat-message">
          Select a chat to view images
        </div>
      </div>
    );
  }

  return (
    <div className="chat-images-list">
      <div className="chat-images-header">
        <h3>Chat Images</h3>
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
            <p>No images yet</p>
            <p className="hint">Upload images by clicking the button above or dragging them here</p>
          </div>
        ) : (
          <div className="images-grid">
            {images.map((image) => (
              <div
                key={image.id}
                className="image-item"
                draggable
                onDragStart={(e) => handleImageDragStart(e, image)}
                onClick={() => handleImageClick(image)}
              >
                <img
                  src={getChatImageUrl(chatId, image.id)}
                  alt={image.original_filename}
                  className="image-thumbnail"
                />
                <div className="image-info">
                  <div className="image-name" title={image.original_filename}>
                    {image.original_filename}
                  </div>
                  <div className="image-size">
                    {(image.file_size / 1024).toFixed(1)} KB
                  </div>
                </div>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default ChatImagesList;