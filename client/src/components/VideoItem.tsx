import { useState } from 'react';
import { renameVideo, moveVideo, restoreVideo } from '../services/apiService';
import type { VideoFile } from '../services/apiService';

interface VideoItemProps {
  video: VideoFile;
  onDelete: (key: string) => void;
  onRename: () => void;
  folders: string[];
}

export const VideoItem = ({ video, onDelete, onRename, folders }: VideoItemProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [moving, setMoving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isInRecycleBin = video.key.startsWith('Recycle Bin/');

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(video.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (deleting) return;
    
    setDeleting(true);
    try {
      await onDelete(video.key);
      setShowDeleteConfirm(false);
    } catch (error) {
      setDeleting(false);
      alert('Failed to delete video');
    }
  };

  const handleStartRename = () => {
    // Extract name without extension
    const lastDotIndex = video.name.lastIndexOf('.');
    const nameWithoutExt = lastDotIndex > 0 ? video.name.substring(0, lastDotIndex) : video.name;
    setIsRenaming(true);
    setNewName(nameWithoutExt);
  };

  const handleRename = async () => {
    if (!newName.trim() || renaming) return;
    
    // Get the file extension from original name
    const lastDotIndex = video.name.lastIndexOf('.');
    const extension = lastDotIndex > 0 ? video.name.substring(lastDotIndex) : '';
    const fullNewName = newName.trim() + extension;
    
    // Check if name actually changed
    if (fullNewName === video.name) {
      setIsRenaming(false);
      return;
    }
    
    setRenaming(true);
    try {
      await renameVideo(video.key, fullNewName);
      onRename();
      setIsRenaming(false);
    } catch (error) {
      alert('Failed to rename video');
    } finally {
      setRenaming(false);
    }
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
    setNewName('');
  };

  const handleStartMove = () => {
    setShowMoveDialog(true);
    setSelectedFolder(video.folder);
  };

  const handleMove = async () => {
    if (!selectedFolder || moving || selectedFolder === video.folder) {
      setShowMoveDialog(false);
      return;
    }
    
    setMoving(true);
    try {
      await moveVideo(video.key, selectedFolder);
      setShowMoveDialog(false);
      onRename(); // Refresh the video list
    } catch (error: any) {
      alert(error.message || 'Failed to move video');
      setMoving(false);
    }
  };

  const handleCancelMove = () => {
    setShowMoveDialog(false);
    setSelectedFolder('');
  };

  const handleRestore = async () => {
    if (restoring) return;
    
    setRestoring(true);
    try {
      await restoreVideo(video.key);
      onRename(); // Refresh the video list
    } catch (error: any) {
      alert(error.message || 'Failed to restore video');
    } finally {
      setRestoring(false);
    }
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
        {isRenaming ? (
          <div className="video-rename-container">
            <input
              type="text"
              className="video-rename-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !renaming) handleRename();
                if (e.key === 'Escape') handleCancelRename();
              }}
              autoFocus
              disabled={renaming}
            />
            <div className="video-rename-actions">
              <button 
                className="confirm-rename-btn" 
                onClick={handleRename}
                disabled={renaming || !newName.trim()}
              >
                {renaming ? '⏳' : '✓'}
              </button>
              <button 
                className="cancel-rename-btn" 
                onClick={handleCancelRename}
                disabled={renaming}
              >
                ✕
              </button>
            </div>
          </div>
        ) : (
          <h4 className="video-name" title={video.name}>
            {video.name}
          </h4>
        )}
        <p className="video-size">{formatFileSize(video.size)}</p>
        <p className="video-date">
          {video.lastModified ? new Date(video.lastModified).toLocaleDateString() : 'Unknown date'}
        </p>
      </div>

      <div className="video-actions">
        {isRenaming ? (
          // Don't show any buttons while renaming - the confirm/cancel are in the rename container above
          null
        ) : showMoveDialog ? (
          <div className="move-dialog">
            <label htmlFor="folder-select">Move to:</label>
            <select
              id="folder-select"
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              disabled={moving}
            >
              {folders.filter(f => f !== 'Recycle Bin').map((folder) => (
                <option key={folder} value={folder}>
                  {folder}
                </option>
              ))}
            </select>
            <div className="move-actions">
              <button 
                className="confirm-move-btn" 
                onClick={handleMove}
                disabled={moving || selectedFolder === video.folder}
              >
                {moving ? '⏳ Moving...' : '✓ Move'}
              </button>
              <button 
                className="cancel-move-btn" 
                onClick={handleCancelMove}
                disabled={moving}
              >
                ✕ Cancel
              </button>
            </div>
          </div>
        ) : !showDeleteConfirm ? (
          <>
            {isInRecycleBin ? (
              // Recycle Bin actions
              <>
                <button
                  className="restore-btn"
                  onClick={handleRestore}
                  disabled={restoring}
                  title="Restore video"
                >
                  {restoring ? '⏳ Restoring...' : '♻️ Restore'}
                </button>
                <button
                  className="delete-btn"
                  onClick={() => setShowDeleteConfirm(true)}
                  title="Permanently delete video"
                >
                  🗑️ Delete Forever
                </button>
              </>
            ) : (
              // Normal actions
              <>
                <button
                  className="copy-url-btn"
                  onClick={handleCopyUrl}
                  title="Copy embed URL"
                >
                  {copied ? '✓ Copied!' : '📋 Copy URL'}
                </button>
                <button
                  className="rename-btn"
                  onClick={handleStartRename}
                  title="Rename video"
                >
                  ✏️ Rename
                </button>
                <button
                  className="move-btn"
                  onClick={handleStartMove}
                  title="Move to another folder"
                >
                  📁 Move
                </button>
                <button
                  className="delete-btn"
                  onClick={() => setShowDeleteConfirm(true)}
                  title="Delete video"
                >
                  🗑️ Delete
                </button>
              </>
            )}
          </>
        ) : (
          <div className="delete-confirm">
            <button 
              className="confirm-delete" 
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? '⏳ Deleting...' : (isInRecycleBin ? 'Permanently Delete' : 'Confirm')}
            </button>
            <button
              className="cancel-delete"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
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
