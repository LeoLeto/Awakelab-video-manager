import { useState, useEffect } from 'react';
import { VideoUploader } from './components/VideoUploader';
import { FolderManager } from './components/FolderManager';
import { VideoList } from './components/VideoList';
import { listVideosFromS3, deleteVideoFromS3, getAllFolders, createFolder, deleteFolder, renameFolder } from './services/s3Service';
import type { VideoFile } from './services/s3Service';
import './App.css';

function App() {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [folders, setFolders] = useState<string[]>(['Uncategorized']);
  const [currentFolder, setCurrentFolder] = useState('Uncategorized');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVideos = async () => {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      const folderList = await getAllFolders();
      setFolders(folderList);
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  };

  useEffect(() => {
    loadVideos();
  }, [currentFolder]);

  useEffect(() => {
    loadFolders();
  }, []);

  const handleUploadSuccess = () => {
    loadVideos();
    loadFolders();
  };

  const handleDelete = async (key: string) => {
    try {
      await deleteVideoFromS3(key);
      loadVideos();
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
      if (currentFolder === oldName) {
        setCurrentFolder(newName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename folder');
    }
  };

  const handleDeleteFolder = async (folderName: string) => {
    try {
      await deleteFolder(folderName);
      await loadFolders();
      if (currentFolder === folderName) {
        setCurrentFolder('Uncategorized');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete folder');
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎥 Video Manager</h1>
        <p>Upload, organize, and manage your videos with AWS S3</p>
      </header>

      <div className="app-container">
        <aside className="sidebar">
          <FolderManager
            folders={folders}
            currentFolder={currentFolder}
            onFolderChange={handleFolderChange}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
          />
        </aside>

        <main className="main-content">
          <VideoUploader
            currentFolder={currentFolder}
            onUploadSuccess={handleUploadSuccess}
          />

          {error && (
            <div className="error-banner">
              {error}
              <button onClick={() => setError(null)}>✕</button>
            </div>
          )}

          <VideoList
            videos={videos}
            onDelete={handleDelete}
            loading={loading}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
