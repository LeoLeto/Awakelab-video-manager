import type { VideoFile } from '../services/apiService';
import { VideoItem } from './VideoItem';

interface VideoListProps {
  videos: VideoFile[];
  onDelete: (key: string) => void;
  onRename: () => void;
  loading: boolean;
  folders: string[];
}

export const VideoList = ({ videos, onDelete, onRename, loading, folders }: VideoListProps) => {
  if (loading) {
    return (
      <div className="video-list">
        <div className="loading">Loading videos...</div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="video-list">
        <div className="empty-state">
          <p>No videos in this folder</p>
          <p className="empty-hint">Upload a video to get started</p>
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
          />
        ))}
      </div>
    </div>
  );
};
