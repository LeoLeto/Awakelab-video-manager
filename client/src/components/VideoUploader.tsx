import { useState, useRef } from 'react';
import { uploadVideoToS3 } from '../services/apiService';

interface VideoUploaderProps {
  currentFolder: string;
  onUploadSuccess: () => void;
}

export const VideoUploader = ({ currentFolder, onUploadSuccess }: VideoUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!validVideoTypes.includes(file.type)) {
      setError('Please select a valid video file (MP4, WebM, OGG, or MOV)');
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      await uploadVideoToS3(file, currentFolder);
      setProgress(100);
      onUploadSuccess();
      
      // Reset form
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload video');
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  return (
    <div className="video-uploader">
      <div className="upload-section">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          disabled={uploading}
          id="video-upload"
          style={{ display: 'none' }}
        />
        <label htmlFor="video-upload" className={`upload-button ${uploading ? 'disabled' : ''}`}>
          {uploading ? 'Uploading...' : 'Upload Video'}
        </label>
        
        {currentFolder !== 'Uncategorized' && (
          <span className="folder-info">to folder: <strong>{currentFolder}</strong></span>
        )}
      </div>

      {uploading && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};
