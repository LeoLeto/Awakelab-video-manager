import { useState } from 'react';
import type { VideoFile } from '../services/apiService';

interface VideoItemProps {
  video: VideoFile;
  onDelete: (key: string) => void;
}

export const VideoItem = ({ video, onDelete }: VideoItemProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(video.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = () => {
    onDelete(video.key);
    setShowDeleteConfirm(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="video-item">
      <div className="video-preview">
        <video controls preload="metadata">
          <source src={video.url} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      <div className="video-info">
        <h4 className="video-name" title={video.name}>
          {video.name}
        </h4>
        <p className="video-size">{formatFileSize(video.size)}</p>
        <p className="video-date">
          {video.lastModified ? new Date(video.lastModified).toLocaleDateString() : 'Unknown date'}
        </p>
      </div>

      <div className="video-actions">
        {!showDeleteConfirm ? (
          <>
            <button
              className="copy-url-btn"
              onClick={handleCopyUrl}
              title="Copy embed URL"
            >
              {copied ? '✓ Copied!' : '📋 Copy URL'}
            </button>
            <button
              className="delete-btn"
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete video"
            >
              🗑️ Delete
            </button>
          </>
        ) : (
          <div className="delete-confirm">
            <button className="confirm-delete" onClick={handleDelete}>
              Confirm
            </button>
            <button
              className="cancel-delete"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {copied && (
        <div className="url-display">
          <code>{video.url}</code>
        </div>
      )}
    </div>
  );
};
