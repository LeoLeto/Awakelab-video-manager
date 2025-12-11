import { useState, useEffect } from 'react';

interface FolderManagerProps {
  folders: string[];
  currentFolder: string;
  onFolderChange: (folder: string) => void;
  onCreateFolder: (folderName: string) => Promise<void>;
  onRenameFolder: (oldName: string, newName: string) => Promise<void>;
  onDeleteFolder: (folderName: string) => Promise<void>;
  loadingFolders: boolean;
}

export const FolderManager = ({
  folders,
  currentFolder,
  onFolderChange,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  loadingFolders,
}: FolderManagerProps) => {
  // Configuration: Set to true to keep all folders expanded
  const KEEP_ALL_EXPANDED = false;

  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [renamingInProgress, setRenamingInProgress] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Auto-expand first two levels when folders load
  useEffect(() => {
    const firstTwoLevels = folders.filter(folder => {
      const level = getNestingLevel(folder);
      return level <= 1; // Levels 0 and 1
    });
    setExpandedFolders(new Set(firstTwoLevels));
  }, [folders]);

  // Helper function to get nesting level
  const getNestingLevel = (folderPath: string) => {
    return folderPath.split('/').length - 1;
  };

  // Helper function to get display name (last part of path)
  const getDisplayName = (folderPath: string) => {
    const parts = folderPath.split('/');
    return parts[parts.length - 1];
  };

  // Helper function to get parent path
  const getParentPath = (folderPath: string) => {
    const parts = folderPath.split('/');
    return parts.slice(0, -1).join('/');
  };

  // Helper function to check if folder should be visible
  const isFolderVisible = (folderPath: string) => {
    if (KEEP_ALL_EXPANDED) return true; // Show all folders when expanded mode is on
    
    // Check if ALL ancestors are expanded
    const parts = folderPath.split('/');
    for (let i = 1; i < parts.length; i++) {
      const ancestorPath = parts.slice(0, i).join('/');
      if (!expandedFolders.has(ancestorPath)) {
        return false; // If any ancestor is collapsed, hide this folder
      }
    }
    
    return true; // All ancestors are expanded
  };

  // Helper function to check if folder has children
  const hasChildren = (folderPath: string) => {
    return folders.some(f => f.startsWith(folderPath + '/') && f !== folderPath);
  };

  // Toggle folder expansion
  const toggleExpand = (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const handleCreateFolder = async () => {
    if (newFolderName.trim() && !creating) {
      setCreating(true);
      try {
        const folderPath = currentFolder && currentFolder !== 'Uncategorized'
          ? `${currentFolder}/${newFolderName.trim()}`
          : newFolderName.trim();
        await onCreateFolder(folderPath);
        setNewFolderName('');
        setIsCreating(false);
        // Auto-expand parent folder
        if (currentFolder && currentFolder !== 'Uncategorized') {
          setExpandedFolders(prev => new Set(prev).add(currentFolder));
        }
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
            placeholder={
              currentFolder && currentFolder !== 'Uncategorized'
                ? `Subfolder of "${getDisplayName(currentFolder)}"`
                : "Folder name"
            }
            onKeyPress={(e) => e.key === 'Enter' && !creating && handleCreateFolder()}
            disabled={creating}
          />
          <button onClick={handleCreateFolder} disabled={creating}>
            {creating ? '⏳ Creating...' : 'Create'}
          </button>
        </div>
      )}

      <div 
        className="folder-list"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onFolderChange('Uncategorized');
          }
        }}
      >
        {loadingFolders ? (
          <div className="loading-folders">⏳ Loading folders...</div>
        ) : (
          folders
            .filter(folder => isFolderVisible(folder))
            .map((folder) => {
              const nestingLevel = getNestingLevel(folder);
              const displayName = getDisplayName(folder);
              const isExpanded = expandedFolders.has(folder);
              const hasSub = hasChildren(folder);

              return (
                <div
                  key={folder}
                  className={`folder-item ${currentFolder === folder ? 'active' : ''}`}
                  style={{ paddingLeft: `${1 + nestingLevel * 1.5}rem` }}
                  onClick={() => {
                    onFolderChange(folder);
                    // Auto-expand if has children
                    if (hasSub && !isExpanded) {
                      setExpandedFolders(prev => new Set(prev).add(folder));
                    }
                  }}
                >
                  {hasSub && (
                    <button
                      className="folder-expand-btn"
                      onClick={(e) => KEEP_ALL_EXPANDED ? e.stopPropagation() : toggleExpand(folder, e)}
                      style={{ cursor: KEEP_ALL_EXPANDED ? 'default' : 'pointer' }}
                    >
                      {KEEP_ALL_EXPANDED ? '▼' : (isExpanded ? '▼' : '▶')}
                    </button>
                  )}
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
                    <span className="folder-name" title={folder}>{displayName}</span>
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
              );
            })
        )}
      </div>
    </div>
  );
};
