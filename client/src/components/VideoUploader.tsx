import { useState, useRef } from 'react';
import { uploadVideoToS3 } from '../services/apiService';

interface VideoUploaderProps {
  currentFolder: string;
  onUploadSuccess: () => void;
}

interface FileUploadProgress {
  name: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

export const VideoUploader = ({ currentFolder, onUploadSuccess }: VideoUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const [fileProgress, setFileProgress] = useState<FileUploadProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files);

    setUploading(true);
    setError(null);
    
    // Initialize progress for all files
    const initialProgress: FileUploadProgress[] = validFiles.map(file => ({
      name: file.name,
      progress: 0,
      status: 'uploading' as const,
    }));
    setFileProgress(initialProgress);

    // Upload files sequentially
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      
      try {
        await uploadVideoToS3(file, currentFolder, (progress) => {
          setFileProgress(prev => 
            prev.map((fp, idx) => 
              idx === i ? { ...fp, progress: Math.round(progress) } : fp
            )
          );
        });
        
        // Mark as completed
        setFileProgress(prev => 
          prev.map((fp, idx) => 
            idx === i ? { ...fp, status: 'completed', progress: 100 } : fp
          )
        );
      } catch (err) {
        // Mark as error
        setFileProgress(prev => 
          prev.map((fp, idx) => 
            idx === i ? { 
              ...fp, 
              status: 'error', 
              error: err instanceof Error ? err.message : 'Upload failed' 
            } : fp
          )
        );
      }
    }

    onUploadSuccess();
    
    // Reset form
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    setUploading(false);
    
    // Clear progress after a delay
    setTimeout(() => setFileProgress([]), 2000);
  };

  return (
    <div className="video-uploader">
      <div className="upload-section">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          disabled={uploading}
          id="video-upload"
          style={{ display: 'none' }}
        />
        <label htmlFor="video-upload" className={`upload-button ${uploading ? 'disabled' : ''}`}>
          {uploading ? 'Uploading...' : 'Upload Files'}
        </label>
        
        {currentFolder !== 'Uncategorized' && (
          <span className="folder-info">to folder: <strong>{currentFolder}</strong></span>
        )}
      </div>

      {fileProgress.length > 0 && (
        <div className="multi-upload-progress">
          {fileProgress.map((fp, idx) => (
            <div key={idx} className="file-upload-item">
              <div className="file-info">
                <span className="file-name">{fp.name}</span>
                <span className={`file-status ${fp.status}`}>
                  {fp.status === 'uploading' && `${fp.progress}%`}
                  {fp.status === 'completed' && '✓ Complete'}
                  {fp.status === 'error' && '✕ Failed'}
                </span>
              </div>
              {fp.status === 'uploading' && (
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${fp.progress}%` }}></div>
                </div>
              )}
              {fp.status === 'error' && fp.error && (
                <div className="file-error">{fp.error}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
    </div>
  );
};
