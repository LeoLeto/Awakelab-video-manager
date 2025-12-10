import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, CopyObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = import.meta.env.VITE_AWS_BUCKET_NAME;
const CUSTOM_DOMAIN = import.meta.env.VITE_AWS_CUSTOM_DOMAIN; // Optional custom domain like 'media.awakelab.world'

export interface VideoFile {
  key: string;
  name: string;
  url: string;
  size: number;
  lastModified: Date;
  folder: string;
}

// Helper function to generate the correct URL
const generateS3Url = (key: string): string => {
  if (CUSTOM_DOMAIN) {
    // Use custom domain if provided (e.g., https://media.awakelab.world/filename.mp4)
    return `https://${CUSTOM_DOMAIN}/${key}`;
  }
  // Use standard S3 URL format
  return `https://${BUCKET_NAME}.s3.${import.meta.env.VITE_AWS_REGION}.amazonaws.com/${key}`;
};

export const uploadVideoToS3 = async (
  file: File,
  folder: string = ''
): Promise<VideoFile> => {
  const fileExtension = file.name.split('.').pop();
  const uniqueFileName = `${uuidv4()}.${fileExtension}`;
  const key = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;

  // Convert File to ArrayBuffer for compatibility
  const fileBuffer = await file.arrayBuffer();

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: new Uint8Array(fileBuffer),
    ContentType: file.type,
  });

  try {
    await s3Client.send(command);
    
    // Generate the S3 URL (using custom domain if available)
    const url = generateS3Url(key);
    
    return {
      key,
      name: file.name,
      url,
      size: file.size,
      lastModified: new Date(),
      folder: folder || 'root',
    };
  } catch (error) {
    console.error('Error uploading video:', error);
    throw new Error('Failed to upload video to S3');
  }
};

export const deleteVideoFromS3 = async (key: string): Promise<void> => {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  try {
    await s3Client.send(command);
  } catch (error) {
    console.error('Error deleting video:', error);
    throw new Error('Failed to delete video from S3');
  }
};

export const listVideosFromS3 = async (folder: string = ''): Promise<VideoFile[]> => {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: folder ? `${folder}/` : '',
  });

  try {
    const response = await s3Client.send(command);
    
    if (!response.Contents) {
      return [];
    }

    return response.Contents
      .filter((item) => !item.Key?.endsWith('.folderkeeper')) // Filter out placeholder files
      .map((item) => {
        const folderPath = item.Key?.split('/').slice(0, -1).join('/') || 'Uncategorized';
        return {
          key: item.Key!,
          name: item.Key!.split('/').pop() || item.Key!,
          url: generateS3Url(item.Key!),
          size: item.Size || 0,
          lastModified: item.LastModified || new Date(),
          folder: folderPath,
        };
      });
  } catch (error) {
    console.error('Error listing videos:', error);
    throw new Error('Failed to list videos from S3');
  }
};

export const getAllFolders = async (): Promise<string[]> => {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Delimiter: '/',
  });

  try {
    const response = await s3Client.send(command);
    const folders = response.CommonPrefixes?.map((prefix) => prefix.Prefix!.replace('/', '')) || [];
    // Filter out 'Uncategorized' if it exists in the S3 response and always add it at the beginning
    const uniqueFolders = folders.filter(f => f !== 'Uncategorized');
    return ['Uncategorized', ...uniqueFolders];
  } catch (error) {
    console.error('Error getting folders:', error);
    return ['Uncategorized'];
  }
};

export const createFolder = async (folderName: string): Promise<void> => {
  // Create a placeholder file to represent the folder
  const key = `${folderName}/.folderkeeper`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: '',
    ContentType: 'text/plain',
  });

  try {
    await s3Client.send(command);
  } catch (error) {
    console.error('Error creating folder:', error);
    throw new Error('Failed to create folder');
  }
};

export const deleteFolder = async (folderName: string): Promise<void> => {
  // Check if folder is empty (only has .folderkeeper file or is completely empty)
  const listCommand = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: `${folderName}/`,
  });

  try {
    const response = await s3Client.send(listCommand);
    const objects = response.Contents || [];
    
    // Filter out .folderkeeper files to check for actual content
    const contentFiles = objects.filter(obj => !obj.Key?.endsWith('.folderkeeper'));
    
    if (contentFiles.length > 0) {
      throw new Error('Folder is not empty. Delete all videos first.');
    }

    // Delete all objects in the folder (including .folderkeeper)
    for (const obj of objects) {
      await deleteVideoFromS3(obj.Key!);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    console.error('Error deleting folder:', error);
    throw new Error('Failed to delete folder');
  }
};

export const renameFolder = async (oldName: string, newName: string): Promise<void> => {
  // List all objects in the old folder
  const listCommand = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: `${oldName}/`,
  });

  try {
    const response = await s3Client.send(listCommand);
    const objects = response.Contents || [];

    // Copy each object to the new folder and delete from old
    for (const obj of objects) {
      const oldKey = obj.Key!;
      const fileName = oldKey.split('/').pop();
      const newKey = `${newName}/${fileName}`;

      // Copy to new location
      const copyCommand = new CopyObjectCommand({
        Bucket: BUCKET_NAME,
        Key: newKey,
        CopySource: `${BUCKET_NAME}/${oldKey}`,
      });
      
      await s3Client.send(copyCommand);
      
      // Delete old object
      await deleteVideoFromS3(oldKey);
    }
  } catch (error) {
    console.error('Error renaming folder:', error);
    throw new Error('Failed to rename folder');
  }
};
