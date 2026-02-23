import type { VideoFile } from '../services/apiService';
import { VideoItem } from './VideoItem';

interface VideoListProps {
  videos   : VideoFile[];
  onDelete : (key: string) => void;
  onRename : () => void;
  loading  : boolean;
  folders  : string[];
  canDelete?: boolean;
  canMove  ?: boolean;
}

export const VideoList = ({ videos, onDelete, onRename, loading, folders, canDelete = true, canMove = true }: VideoListProps) => {
  if (loading) {
    return (
      <div className="video-list">
        <div className="loading">Cargando archivos...</div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="video-list">
        <div className="empty-state">
          <p>No hay archivos en esta carpeta</p>
          <p className="empty-hint">Sube un archivo para comenzar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="video-list">
      <div className="video-grid">
        {videos.map((video) => (
          <VideoItem 
            key={video.key} 
            video={video} 
            onDelete={onDelete} 
            onRename={onRename}
            folders={folders}
            canDelete={canDelete}
            canMove={canMove}
          />
        ))}
      </div>
    </div>
  );
};
