export interface VideoFile {
  key: string;
  name: string;
  size: number;
  lastModified?: Date;
  folder: string;
  url: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Callback fired whenever any authenticated request returns 401
let _onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { _onUnauthorized = fn; };

// Helper function to get auth headers
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
};

// Authenticated fetch — triggers logout if the server returns 401
const authFetch = async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
  const res = await fetch(input, init);
  if (res.status === 401 && _onUnauthorized) {
    _onUnauthorized();
  }
  return res;
};

// Helper function to get auth token for XHR requests
const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

export const listVideosFromS3 = async (folder: string = ''): Promise<VideoFile[]> => {
  try {
    const token = getAuthToken();
    const response = await authFetch(`${API_BASE_URL}/videos?folder=${encodeURIComponent(folder)}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
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
    // Step 1: request a presigned PUT URL from our server (auth + permission check happens here)
    const token = getAuthToken();
    const presignRes = await authFetch(`${API_BASE_URL}/upload/presigned-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify({ folder, filename: file.name, contentType: file.type }),
    });

    if (!presignRes.ok) {
      const err = await presignRes.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Failed to get upload URL');
    }

    const { uploadUrl, key } = await presignRes.json();

    // Step 2: upload directly to S3 — the file never passes through our server
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress((e.loaded / e.total) * 100);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`S3 upload failed (${xhr.status})`))
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Upload failed')));

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });

    return key;
  } catch (error) {
    console.error('Error uploading video:', error);
    throw error;
  }
};

export const replaceVideo = async (
  key: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<void> => {
  try {
    const token = getAuthToken();

    // Step 1: request presigned URL (server validates the file extension here)
    const presignRes = await authFetch(`${API_BASE_URL}/videos/${encodeURIComponent(key)}/replace/presigned-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify({ filename: file.name, contentType: file.type }),
    });

    if (!presignRes.ok) {
      const err = await presignRes.json().catch(() => ({ error: 'Replace failed' }));
      throw new Error(err.error || 'Replace failed');
    }

    const { uploadUrl } = await presignRes.json();

    // Step 2: upload directly to S3
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress((e.loaded / e.total) * 100);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`S3 upload failed (${xhr.status})`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Replace failed')));

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });

    // Step 3: notify server to invalidate CloudFront cache
    await authFetch(`${API_BASE_URL}/videos/${encodeURIComponent(key)}/replace/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    });
  } catch (error) {
    console.error('Error replacing video:', error);
    throw error;
  }
};

export const deleteVideoFromS3 = async (key: string): Promise<void> => {
  try {
    const response = await authFetch(`${API_BASE_URL}/videos/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to delete video');
    }
  } catch (error) {
    console.error('Error deleting video:', error);
    throw error;
  }
};

export const renameVideo = async (key: string, newName: string): Promise<{ newKey: string; url: string }> => {
  try {
    const response = await authFetch(`${API_BASE_URL}/videos/${encodeURIComponent(key)}/rename`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ newName }),
    });
    if (!response.ok) {
      throw new Error('Failed to rename video');
    }
    return await response.json();
  } catch (error) {
    console.error('Error renaming video:', error);
    throw error;
  }
};

export const moveVideo = async (key: string, targetFolder: string): Promise<{ newKey: string; url: string }> => {
  try {
    const response = await authFetch(`${API_BASE_URL}/videos/${encodeURIComponent(key)}/move`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ targetFolder }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to move video' }));
      throw new Error(errorData.error || 'Failed to move video');
    }
    return await response.json();
  } catch (error) {
    console.error('Error moving video:', error);
    throw error;
  }
};

export const restoreVideo = async (key: string): Promise<{ restoredKey: string; url: string }> => {
  try {
    const response = await authFetch(`${API_BASE_URL}/videos/${encodeURIComponent(key)}/restore`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to restore video' }));
      throw new Error(errorData.error || 'Failed to restore video');
    }
    return await response.json();
  } catch (error) {
    console.error('Error restoring video:', error);
    throw error;
  }
};

export const getAllFolders = async (): Promise<string[]> => {
  try {
    const token = getAuthToken();
    const response = await authFetch(`${API_BASE_URL}/folders`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
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
    const response = await authFetch(`${API_BASE_URL}/folders`, {
      method: 'POST',
      headers: getAuthHeaders(),
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
    const response = await authFetch(`${API_BASE_URL}/folders/rename`, {
      method: 'PUT',
      headers: getAuthHeaders(),
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
    const token = getAuthToken();
    const response = await authFetch(`${API_BASE_URL}/folders/${encodeURIComponent(folderName)}`, {
      method: 'DELETE',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to delete folder' }));
      throw new Error(errorData.error || 'Failed to delete folder');
    }
  } catch (error) {
    console.error('Error deleting folder:', error);
    throw error;
  }
};

// ─── Admin: User management ──────────────────────────────────────────────────

export interface UserPermissions {
  directoryAccess    : 'all' | 'specific';
  allowedDirectories : string[];
  canUpload          : boolean;
  canDelete          : boolean;
  canMove            : boolean;
}

export interface AdminUser {
  username   : string;
  isAdmin    : boolean;
  permissions: UserPermissions;
}

export const adminGetUsers = async (): Promise<AdminUser[]> => {
  const response = await authFetch(`${API_BASE_URL}/admin/users`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error('Failed to fetch users');
  const data = await response.json();
  return data.users;
};

export const adminCreateUser = async (
  username: string,
  password: string,
  isAdmin: boolean,
  permissions: UserPermissions,
): Promise<AdminUser> => {
  const response = await authFetch(`${API_BASE_URL}/admin/users`, {
    method : 'POST',
    headers: getAuthHeaders(),
    body   : JSON.stringify({ username, password, isAdmin, permissions }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to create user' }));
    throw new Error(err.error || 'Failed to create user');
  }
  const data = await response.json();
  return data.user;
};

export const adminUpdateUser = async (
  username: string,
  updates: { isAdmin?: boolean; permissions?: Partial<UserPermissions>; password?: string },
): Promise<AdminUser> => {
  const response = await authFetch(`${API_BASE_URL}/admin/users/${encodeURIComponent(username)}`, {
    method : 'PUT',
    headers: getAuthHeaders(),
    body   : JSON.stringify(updates),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to update user' }));
    throw new Error(err.error || 'Failed to update user');
  }
  const data = await response.json();
  return data.user;
};

export const adminDeleteUser = async (username: string): Promise<void> => {
  const response = await authFetch(`${API_BASE_URL}/admin/users/${encodeURIComponent(username)}`, {
    method : 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to delete user' }));
    throw new Error(err.error || 'Failed to delete user');
  }
};

export const changeOwnPassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  const response = await authFetch(`${API_BASE_URL}/user/password`, {
    method : 'PUT',
    headers: getAuthHeaders(),
    body   : JSON.stringify({ currentPassword, newPassword }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to change password' }));
    throw new Error(err.error || 'Failed to change password');
  }
};

