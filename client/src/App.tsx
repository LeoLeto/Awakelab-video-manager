import { useState, useEffect } from 'react';
import { VideoUploader } from './components/VideoUploader';
import { FolderManager } from './components/FolderManager';
import { VideoList } from './components/VideoList';
import { Login } from './components/Login';
import { UserManager } from './components/UserManager';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { listVideosFromS3, deleteVideoFromS3, getAllFolders, createFolder, deleteFolder, renameFolder, changeOwnPassword } from './services/apiService';
import type { VideoFile } from './services/apiService';
import './App.css';

const APP_VERSION = '2.4';

// ─── Self-service password change modal ──────────────────────────────────────
function SelfChangePasswordModal({ username, onClose }: { username: string; onClose: () => void }) {
  const [currentPw,      setCurrentPw]      = useState('');
  const [newPw,          setNewPw]          = useState('');
  const [showCurrent,    setShowCurrent]    = useState(false);
  const [showNew,        setShowNew]        = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [success,        setSuccess]        = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPw || !newPw.trim()) {
      setError('Completa ambos campos.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await changeOwnPassword(currentPw, newPw.trim());
      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar contraseña');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="scp-overlay" onClick={onClose}>
      <div className="scp-modal" onClick={e => e.stopPropagation()}>
        <div className="scp-header">
          <h3>Cambiar contraseña</h3>
          <button className="scp-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="scp-body">
          {error   && <div className="scp-error">{error}</div>}
          {success && <div className="scp-success">✔ Contraseña actualizada</div>}
          <p className="scp-user">👤 <strong>{username}</strong></p>
          <div className="scp-field">
            <label>Contraseña actual</label>
            <div className="scp-pw-wrap">
              <input type={showCurrent ? 'text' : 'password'} value={currentPw}
                onChange={e => setCurrentPw(e.target.value)} placeholder="••••••••" autoFocus />
              <button type="button" onClick={() => setShowCurrent(v => !v)} title="Ver">
                {showCurrent ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <div className="scp-field">
            <label>Nueva contraseña</label>
            <div className="scp-pw-wrap">
              <input type={showNew ? 'text' : 'password'} value={newPw}
                onChange={e => setNewPw(e.target.value)} placeholder="••••••••" />
              <button type="button" onClick={() => setShowNew(v => !v)} title="Ver">
                {showNew ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <div className="scp-footer">
            <button type="button" className="scp-btn scp-btn--secondary" onClick={onClose}>Cancelar</button>
            <button type="submit"  className="scp-btn scp-btn--primary"   disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VideoManagerContent() {
  const { isAuthenticated, loading: authLoading, username, logout, isAdmin, permissions } = useAuth();
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [videoCache, setVideoCache] = useState<Map<string, VideoFile[]>>(new Map());
  const [folders, setFolders] = useState<string[]>(['Uncategorized', 'Recycle Bin']);
  const [currentFolder, setCurrentFolder] = useState('Uncategorized');
  const [loading, setLoading] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView]                         = useState<'videos' | 'admin'>('videos');
  const [showSelfPasswordModal, setShowSelfPasswordModal] = useState(false);

  const loadVideos = async (forceRefresh: boolean = false) => {
    // Check cache first
    if (!forceRefresh && videoCache.has(currentFolder)) {
      setVideos(videoCache.get(currentFolder)!);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const folderPrefix = currentFolder === 'root' ? '' : currentFolder;
      const videoList = await listVideosFromS3(folderPrefix);
      
      // Filter videos to show only those in the current folder
      const filteredVideos = videoList.filter((video) => {
        if (currentFolder === 'Uncategorized') {
          return !video.key.includes('/') || video.folder === 'Uncategorized';
        }
        return video.folder === currentFolder;
      });
      
      setVideos(filteredVideos);
      
      // Update cache
      setVideoCache(prev => new Map(prev).set(currentFolder, filteredVideos));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    setLoadingFolders(true);
    try {
      const folderList = await getAllFolders();
      setFolders(folderList);
    } catch (err) {
      console.error('Failed to load folders:', err);
    } finally {
      setLoadingFolders(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadVideos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolder, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      setView('videos'); // reset on every new login
      loadFolders();
    }
  }, [isAuthenticated]);

  const handleUploadSuccess = () => {
    loadVideos(true); // Force refresh after upload
    loadFolders();
  };

  const handleDelete = async (key: string) => {
    try {
      await deleteVideoFromS3(key);
      // Clear cache for all folders since video might be moved to Recycle Bin
      setVideoCache(new Map());
      loadVideos(true); // Force refresh after delete
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete video');
    }
  };

  const handleFolderChange = (folder: string) => {
    setCurrentFolder(folder);
  };

  const handleCreateFolder = async (folderName: string) => {
    if (folders.includes(folderName)) {
      setError('Folder already exists');
      return;
    }
    
    try {
      await createFolder(folderName);
      await loadFolders();
      setCurrentFolder(folderName);
      // New folder will be empty, no need to fetch
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const handleRenameFolder = async (oldName: string, newName: string) => {
    if (folders.includes(newName)) {
      setError('A folder with that name already exists');
      return;
    }

    try {
      await renameFolder(oldName, newName);
      await loadFolders();
      
      // Update cache: move old folder's cache to new name
      setVideoCache(prev => {
        const newCache = new Map(prev);
        if (newCache.has(oldName)) {
          newCache.set(newName, newCache.get(oldName)!);
          newCache.delete(oldName);
        }
        return newCache;
      });
      
      if (currentFolder === oldName) {
        setCurrentFolder(newName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename folder');
    }
  };

  const handleDeleteFolder = async (folderName: string) => {
    // Client-side validation: Check if folder has videos
    try {
      const folderVideos = await listVideosFromS3(folderName);
      const videosInFolder = folderVideos.filter(video => video.folder === folderName);
      
      if (videosInFolder.length > 0) {
        setError('Cannot delete folder that contains videos. Please delete or move all videos first.');
        throw new Error('Cannot delete folder that contains videos. Please delete or move all videos first.');
      }

      await deleteFolder(folderName);
      await loadFolders();
      
      // Clear cache for deleted folder
      setVideoCache(prev => {
        const newCache = new Map(prev);
        newCache.delete(folderName);
        return newCache;
      });
      
      if (currentFolder === folderName) {
        setCurrentFolder('Uncategorized');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete folder');
      throw err; // Re-throw so FolderManager can handle it
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="app loading-screen">
        <div className="loading-content">
          <h1>🎥 Video Manager</h1>
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  const effectiveView = isAdmin ? view : 'videos';

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-title">
            <h1>🎥 Video Manager</h1>
            <p>Upload, organize, and manage your videos with AWS S3</p>
          </div>
          <div className="header-user">
            {isAdmin && (
              <button
                onClick={() => setView(v => v === 'admin' ? 'videos' : 'admin')}
                className={`admin-nav-button ${effectiveView === 'admin' ? 'admin-nav-button--active' : ''}`}
              >
                {effectiveView === 'admin' ? '🎥 Videos' : '⚙️ Usuarios'}
              </button>
            )}
            <button
              className="username-button"
              onClick={() => setShowSelfPasswordModal(true)}
              title="Cambiar mi contraseña"
            >
              👤 {username}{isAdmin && ' (Admin)'}
            </button>
            <button onClick={logout} className="logout-button">Logout</button>
          </div>
        </div>
        <span className="app-version">v{APP_VERSION}</span>
      </header>

      {showSelfPasswordModal && username && (
        <SelfChangePasswordModal
          username={username}
          onClose={() => setShowSelfPasswordModal(false)}
        />
      )}

      {effectiveView === 'admin' ? (
        <div className="admin-area">
          <UserManager folders={folders} />
        </div>
      ) : (
        <div className="app-container">
          <aside className="sidebar">
            <FolderManager
              folders={folders}
              currentFolder={currentFolder}
              onFolderChange={handleFolderChange}
              onCreateFolder={handleCreateFolder}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
              loadingFolders={loadingFolders}
            />
          </aside>

          <main className="main-content">
            {currentFolder !== 'Recycle Bin' && (isAdmin || permissions.canUpload) && (
              <VideoUploader
                currentFolder={currentFolder}
                onUploadSuccess={handleUploadSuccess}
              />
            )}

            {error && (
              <div className="error-banner">
                {error}
                <button onClick={() => setError(null)}>✕</button>
              </div>
            )}

            <VideoList
              videos={videos}
              onDelete={handleDelete}
              onRename={() => {
                setVideoCache(new Map());
                loadVideos(true);
              }}
              loading={loading}
              folders={folders}
              canDelete={isAdmin || permissions.canDelete}
              canMove={isAdmin || permissions.canMove}
            />
          </main>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <VideoManagerContent />
    </AuthProvider>
  );
}

export default App;
