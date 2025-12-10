export interface VideoFile {
  key: string;
  name: string;
  size: number;
  lastModified?: Date;
  folder: string;
  url: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const listVideosFromS3 = async (folder: string = ''): Promise<VideoFile[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/videos?folder=${encodeURIComponent(folder)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch videos');
    }
    const data = await response.json();
    return data.videos.map((video: VideoFile & { lastModified?: string }) => ({
      ...video,
      lastModified: video.lastModified ? new Date(video.lastModified) : undefined,
    }));
  } catch (error) {
    console.error('Error listing videos:', error);
    throw error;
  }
};

export const uploadVideoToS3 = async (
  file: File,
  folder: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('folder', folder);

    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = (e.loaded / e.total) * 100;
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          resolve(response.key);
        } else {
          reject(new Error('Upload failed'));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('POST', `${API_BASE_URL}/upload`);
      xhr.send(formData);
    });
  } catch (error) {
    console.error('Error uploading video:', error);
    throw error;
  }
};

export const deleteVideoFromS3 = async (key: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/videos/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete video');
    }
  } catch (error) {
    console.error('Error deleting video:', error);
    throw error;
  }
};

export const getAllFolders = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/folders`);
    if (!response.ok) {
      throw new Error('Failed to fetch folders');
    }
    const data = await response.json();
    return data.folders;
  } catch (error) {
    console.error('Error getting folders:', error);
    throw error;
  }
};

export const createFolder = async (folderName: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/folders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ folderName }),
    });
    if (!response.ok) {
      throw new Error('Failed to create folder');
    }
  } catch (error) {
    console.error('Error creating folder:', error);
    throw error;
  }
};

export const renameFolder = async (oldName: string, newName: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/folders/rename`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ oldName, newName }),
    });
    if (!response.ok) {
      throw new Error('Failed to rename folder');
    }
  } catch (error) {
    console.error('Error renaming folder:', error);
    throw error;
  }
};

export const deleteFolder = async (folderName: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/folders/${encodeURIComponent(folderName)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete folder');
    }
  } catch (error) {
    console.error('Error deleting folder:', error);
    throw error;
  }
};
