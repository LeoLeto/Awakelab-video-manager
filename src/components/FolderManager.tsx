import { useState } from 'react';

interface FolderManagerProps {
  folders: string[];
  currentFolder: string;
  onFolderChange: (folder: string) => void;
  onCreateFolder: (folderName: string) => Promise<void>;
  onRenameFolder: (oldName: string, newName: string) => Promise<void>;
  onDeleteFolder: (folderName: string) => Promise<void>;
}

export const FolderManager = ({
  folders,
  currentFolder,
  onFolderChange,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: FolderManagerProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [renamingInProgress, setRenamingInProgress] = useState(false);

  const handleCreateFolder = async () => {
    if (newFolderName.trim() && !creating) {
      setCreating(true);
      try {
        await onCreateFolder(newFolderName.trim());
        setNewFolderName('');
        setIsCreating(false);
      } finally {
        setCreating(false);
      }
    }
  };

  const handleStartRename = (folder: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (folder === 'Uncategorized') return;
    setRenamingFolder(folder);
    setRenameValue(folder);
  };

  const handleRename = async (oldName: string) => {
    if (renameValue.trim() && renameValue !== oldName && !renamingInProgress) {
      setRenamingInProgress(true);
      try {
        await onRenameFolder(oldName, renameValue.trim());
        setRenamingFolder(null);
        setRenameValue('');
      } finally {
        setRenamingInProgress(false);
      }
    } else {
      setRenamingFolder(null);
      setRenameValue('');
    }
  };

  const handleDeleteClick = (folder: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (folder === 'Uncategorized' || deletingFolder) return;
    setConfirmDelete(folder);
  };

  const handleConfirmDelete = async (folder: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(null);
    setDeletingFolder(folder);
    try {
      await onDeleteFolder(folder);
    } finally {
      setDeletingFolder(null);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(null);
  };

  return (
    <div className="folder-manager">
      <div className="folder-header">
        <h3>Folders</h3>
        <button
          className="create-folder-btn"
          onClick={() => setIsCreating(!isCreating)}
        >
          {isCreating ? 'Cancel' : '+ New Folder'}
        </button>
      </div>

      {isCreating && (
        <div className="create-folder-form">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            onKeyPress={(e) => e.key === 'Enter' && !creating && handleCreateFolder()}
            disabled={creating}
          />
          <button onClick={handleCreateFolder} disabled={creating}>
            {creating ? '⏳ Creating...' : 'Create'}
          </button>
        </div>
      )}

      <div className="folder-list">
        {folders.map((folder) => (
          <div
            key={folder}
            className={`folder-item ${currentFolder === folder ? 'active' : ''}`}
            onClick={() => onFolderChange(folder)}
          >
            <span className="folder-icon">📁</span>
            {renamingFolder === folder ? (
              <div className="folder-rename-container">
                <input
                  type="text"
                  className={`folder-rename-input ${renamingInProgress ? 'renaming' : ''}`}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !renamingInProgress) handleRename(folder);
                    if (e.key === 'Escape') setRenamingFolder(null);
                  }}
                  onBlur={() => !renamingInProgress && handleRename(folder)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  disabled={renamingInProgress}
                />
                {renamingInProgress && (
                  <span className="renaming-overlay">⏳ Renaming...</span>
                )}
              </div>
            ) : (
              <span className="folder-name">{folder}</span>
            )}
            {folder !== 'Uncategorized' && (
              <>
                {confirmDelete === folder ? (
                  <div className="folder-delete-confirm">
                    <button
                      className="folder-confirm-btn"
                      onClick={(e) => handleConfirmDelete(folder, e)}
                    >
                      ✓
                    </button>
                    <button
                      className="folder-cancel-btn"
                      onClick={handleCancelDelete}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className={`folder-actions ${deletingFolder === folder ? 'active' : ''}`}>
                    <button
                      className="folder-action-btn"
                      onClick={(e) => handleStartRename(folder, e)}
                      title="Rename folder"
                      disabled={deletingFolder === folder}
                    >
                      ✏️
                    </button>
                    <button
                      className="folder-action-btn"
                      onClick={(e) => handleDeleteClick(folder, e)}
                      title="Delete folder"
                      disabled={deletingFolder === folder}
                    >
                      {deletingFolder === folder ? '⏳' : '🗑️'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
