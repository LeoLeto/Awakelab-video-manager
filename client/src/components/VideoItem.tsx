import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { renameVideo, moveVideo, restoreVideo, replaceVideo } from '../services/apiService';
import type { VideoFile } from '../services/apiService';
import iconUrl from '../assets/icons/cyan-url.png';
import iconRename from '../assets/icons/ccyan-rername.png';
import iconFolder from '../assets/icons/cyan-folder.png';
import iconTrash from '../assets/icons/cyan-trash.png';

interface VideoItemProps {
  video     : VideoFile;
  onDelete  : (key: string) => void;
  onRename  : () => void;
  folders   : string[];
  canDelete ?: boolean;
  canMove   ?: boolean;
  canUpload ?: boolean;
}

export const VideoItem = ({ video, onDelete, onRename, folders, canDelete = true, canMove = true, canUpload = true }: VideoItemProps) => {
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
  const [replacing, setReplacing] = useState(false);
  const [replaceProgress, setReplaceProgress] = useState(0);
  const [showReplaceSuccess, setShowReplaceSuccess] = useState(false);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const isInRecycleBin = video.key.startsWith('Recycle Bin/');

  // Helper to check if file is a video
  const isVideoFile = (fileName: string) => {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v'];
    return videoExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  };

  // Helper to get file extension
  const getFileExtension = (fileName: string) => {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot > 0 ? fileName.substring(lastDot + 1).toUpperCase() : 'FILE';
  };

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
      alert('Error al eliminar el archivo');
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
      alert('Error al renombrar el archivo');
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
      alert(error.message || 'Error al mover el archivo');
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
      alert(error.message || 'Error al restaurar el archivo');
    } finally {
      setRestoring(false);
    }
  };

  const handleReplaceClick = () => {
    replaceFileInputRef.current?.click();
  };

  const handleReplaceFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate that the replacement file has the same extension
    const getExt = (name: string) => name.slice(name.lastIndexOf('.')).toLowerCase();
    const existingExt = getExt(video.name);
    const newExt = getExt(file.name);
    if (existingExt !== newExt) {
      alert(`El archivo debe ser del mismo tipo que el original (${existingExt}). El archivo seleccionado es ${newExt}.`);
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
      return;
    }

    setReplacing(true);
    setReplaceProgress(0);
    try {
      await replaceVideo(video.key, file, (progress) => {
        // Scale XHR transfer progress to 0-90%; the remaining 10% represents
        // the server-side S3 upload that happens after the browser finishes sending.
        setReplaceProgress(Math.round(progress * 0.9));
      });
      setReplaceProgress(100);
      setShowReplaceSuccess(true);
    } catch (error: any) {
      alert(error.message || 'Error al reemplazar el archivo');
    } finally {
      setReplacing(false);
      setReplaceProgress(0);
      // Reset the input so the same file can be selected again if needed
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const replaceSuccessModal = showReplaceSuccess && createPortal(
    <div className="replace-success-overlay" onClick={() => { setShowReplaceSuccess(false); onRename(); }}>
      <div className="replace-success-modal" onClick={(e) => e.stopPropagation()}>
        <div className="replace-success-icon">✅</div>
        <h4>Archivo reemplazado</h4>
        <p>
          El archivo fue subido correctamente y la URL se mantiene igual.
        </p>
        <p className="replace-success-note">
          ⏱️ El caché de CDN puede tardar hasta <strong>5 minutos</strong> en actualizarse. Durante ese tiempo algunos usuarios podrían ver la versión anterior.
        </p>
        <button className="replace-success-close" onClick={() => { setShowReplaceSuccess(false); onRename(); }}>
          Entendido
        </button>
      </div>
    </div>,
    document.body
  );

  return (
    <div className="video-item">
      {replaceSuccessModal}

      {/* Hidden file input for replace */}
      <input
        ref={replaceFileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleReplaceFileSelect}
        disabled={replacing}
      />

      {replacing && (
        <div className="replace-progress-overlay">
          <div className="replace-progress-bar">
            <div className="replace-progress-fill" style={{ width: `${replaceProgress}%` }}></div>
          </div>
          <span className="replace-progress-label">Reemplazando... {replaceProgress}%</span>
        </div>
      )}

      <div className="video-preview">
        {isVideoFile(video.name) ? (
          <video controls preload="metadata">
            <source src={video.url} type="video/mp4" />
            Tu navegador no es compatible con la etiqueta de video.
          </video>
        ) : (
          <div className="file-icon-preview">
            <div className="file-icon">
              <span className="file-extension">{getFileExtension(video.name)}</span>
            </div>
          </div>
        )}
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
          {video.lastModified ? new Date(video.lastModified).toLocaleDateString() : 'Fecha desconocida'}
        </p>
      </div>

      <div className="video-actions">
        {isRenaming ? (
          // Don't show any buttons while renaming - the confirm/cancel are in the rename container above
          null
        ) : showMoveDialog ? (
          <div className="move-dialog">
            <label htmlFor="folder-select">Mover a:</label>
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
                {moving ? '⏳ Moviendo...' : '✓ Mover'}
              </button>
              <button 
                className="cancel-move-btn" 
                onClick={handleCancelMove}
                disabled={moving}
              >
                ✕ Cancelar
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
                  title="Restaurar archivo"
                >
                  {restoring ? 'Restaurando...' : 'Restaurar'}
                </button>
                {canDelete && (
                  <button
                    className="delete-btn"
                    onClick={() => setShowDeleteConfirm(true)}
                    title="Eliminar permanentemente"
                  >
                    <img src={iconTrash} alt="" className="btn-icon" /> Eliminar Para Siempre
                  </button>
                )}
              </>
            ) : (
              // Normal actions
              <>
                <button
                  className="copy-url-btn"
                  onClick={handleCopyUrl}
                  title="Copiar URL"
                >
                  {copied ? '✓ Copiado!' : <><img src={iconUrl} alt="" className="btn-icon" /> Copiar URL</>}
                </button>
                <button
                  className="rename-btn"
                  onClick={handleStartRename}
                  title="Renombrar archivo"
                >
                  <img src={iconRename} alt="" className="btn-icon" /> Renombrar
                </button>
                {canUpload && (
                  <button
                    className="replace-btn"
                    onClick={handleReplaceClick}
                    disabled={replacing}
                    title="Reemplazar archivo (preserva la URL)"
                  >
                    🔄 Reemplazar
                  </button>
                )}
                {canMove && (
                  <button
                    className="move-btn"
                    onClick={handleStartMove}
                    title="Mover a otra carpeta"
                  >
                    <img src={iconFolder} alt="" className="btn-icon" /> Mover
                  </button>
                )}
                {canDelete && (
                  <button
                    className="delete-btn"
                    onClick={() => setShowDeleteConfirm(true)}
                    title="Eliminar archivo"
                  >
                    <img src={iconTrash} alt="" className="btn-icon" /> Eliminar
                  </button>
                )}
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
              {deleting ? '⏳ Eliminando...' : (isInRecycleBin ? 'Eliminar Permanentemente' : 'Confirmar')}
            </button>
            <button
              className="cancel-delete"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              Cancelar
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
