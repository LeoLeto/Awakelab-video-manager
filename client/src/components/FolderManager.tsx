import { useState } from 'react';

interface FolderManagerProps {
  folders: string[];
  currentFolder: string;
  onFolderChange: (folder: string) => void;
  onCreateFolder: (folderName: string) => Promise<void>;
  onRenameFolder: (oldName: string, newName: string) => Promise<void>;
  onDeleteFolder: (folderName: string) => Promise<void>;
  loadingFolders: boolean;
  isAdmin: boolean;
}

export const FolderManager = ({
  folders,
  currentFolder,
  onFolderChange,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  loadingFolders,
  isAdmin,
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
  const [searchQuery,     setSearchQuery]     = useState('');

  // Closest ancestor that is actually present in the visible folder list
  // (parents may be filtered out by directory-access permissions).
  const getVisibleAncestor = (folderPath: string): string | null => {
    const parts = folderPath.split('/');
    for (let i = parts.length - 1; i > 0; i--) {
      const ancestorPath = parts.slice(0, i).join('/');
      if (folders.includes(ancestorPath)) return ancestorPath;
    }
    return null;
  };

  // Nesting level relative to visible ancestors (so orphaned subfolders sit at depth 0).
  const getNestingLevel = (folderPath: string) => {
    const parts = folderPath.split('/');
    let level = 0;
    for (let i = 1; i < parts.length; i++) {
      const ancestorPath = parts.slice(0, i).join('/');
      if (folders.includes(ancestorPath)) level++;
    }
    return level;
  };

  // Display name shows path from the closest visible ancestor down to the leaf;
  // if no ancestor is visible (orphan), show the full path so the folder isn't ambiguous.
  const getDisplayName = (folderPath: string) => {
    const ancestor = getVisibleAncestor(folderPath);
    if (ancestor) return folderPath.slice(ancestor.length + 1);
    return folderPath;
  };

  // Helper function to check if folder should be visible
  const isFolderVisible = (folderPath: string) => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const selfMatches = folderPath.toLowerCase().includes(q);
      const hasMatchingDescendant = folders.some(
        f => f !== folderPath && f.startsWith(folderPath + '/') && f.toLowerCase().includes(q)
      );
      return selfMatches || hasMatchingDescendant;
    }
    if (KEEP_ALL_EXPANDED) return true;
    const parts = folderPath.split('/');
    // Only enforce collapsed state for ancestors actually present in the folder list.
    // Ancestors filtered out by permissions shouldn't hide their descendants.
    for (let i = 1; i < parts.length; i++) {
      const ancestorPath = parts.slice(0, i).join('/');
      if (folders.includes(ancestorPath) && !expandedFolders.has(ancestorPath)) return false;
    }
    return true;
  };

  const highlightMatch = (text: string): React.ReactNode => {
    const q = searchQuery.trim();
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="folder-search-highlight">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
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
    if (folder === 'Uncategorized' || folder === 'Recycle Bin') return;
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
    if (folder === 'Uncategorized' || folder === 'Recycle Bin' || deletingFolder) return;
    setConfirmDelete(folder);
  };

  const handleConfirmDelete = async (folder: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(null);
    setDeletingFolder(folder);
    try {
      await onDeleteFolder(folder);
    } catch (error) {
      // Error is handled by parent component (App.tsx)
      // Just reset the UI state
      console.error('Failed to delete folder:', error);
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
        <h3>Carpetas</h3>
        <button
          className="create-folder-btn"
          onClick={() => setIsCreating(!isCreating)}
        >
          {isCreating ? 'Cancelar' : '+ Nueva Carpeta'}
        </button>
      </div>

      <div className="folder-search">
        <input
          type="text"
          className="folder-search-input"
          placeholder="Buscar carpetas..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="folder-search-clear" onClick={() => setSearchQuery('')}>✕</button>
        )}
      </div>

      {isCreating && (
        <div className="create-folder-form">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder={
              currentFolder && currentFolder !== 'Uncategorized'
                ? `Subcarpeta de "${getDisplayName(currentFolder)}"`
                : "Nombre de carpeta"
            }
            onKeyPress={(e) => e.key === 'Enter' && !creating && handleCreateFolder()}
            disabled={creating}
          />
          <button onClick={handleCreateFolder} disabled={creating}>
            {creating ? '⏳ Creando...' : 'Crear'}
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
          <div className="loading-folders">⏳ Cargando carpetas...</div>
        ) : (
          folders
            .filter(folder => isFolderVisible(folder))
            .sort((a, b) => {
              // Always put Recycle Bin last
              if (a === 'Recycle Bin') return 1;
              if (b === 'Recycle Bin') return -1;
              return 0;
            })
            .map((folder) => {
              const nestingLevel = getNestingLevel(folder);
              const displayName = getDisplayName(folder);
              const isSearching = !!searchQuery.trim();
              const isExpanded  = isSearching || expandedFolders.has(folder);
              const hasSub      = hasChildren(folder);

              return (
                <div
                  key={folder}
                  className={`folder-item ${currentFolder === folder ? 'active' : ''} ${folder === 'Recycle Bin' ? 'recycle-bin' : ''}`}
                  style={{ paddingLeft: `${0.75 + nestingLevel * 1}rem` }}
                  onClick={() => {
                    onFolderChange(folder);
                    if (hasSub) {
                      setExpandedFolders(prev => {
                        const next = new Set(prev);
                        if (next.has(folder)) next.delete(folder); else next.add(folder);
                        return next;
                      });
                    }
                  }}
                >
                  {hasSub && !isSearching && (
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
                        <span className="renaming-overlay">⏳ Renombrando...</span>
                      )}
                    </div>
                  ) : (
                    <span className="folder-name" title={folder}>
                      {folder === 'Recycle Bin' && '🗑️ '}{highlightMatch(displayName)}
                    </span>
                  )}
                  {folder !== 'Uncategorized' && folder !== 'Recycle Bin' && (
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
                            title="Renombrar carpeta"
                            disabled={deletingFolder === folder}
                          >
                            ✏️
                          </button>
                          {isAdmin && (
                            <button
                              className="folder-action-btn"
                              onClick={(e) => handleDeleteClick(folder, e)}
                              title="Eliminar carpeta"
                              disabled={deletingFolder === folder}
                            >
                              {deletingFolder === folder ? '⏳' : '🗑️'}
                            </button>
                          )}
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
