import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { 
  S3Client, 
  PutObjectCommand, 
  ListObjectsV2Command, 
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors({
  origin: [
    "https://video-manager.awakelab.world",
    "http://video-manager.awakelab.world",
    "http://localhost:5173",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || `${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`;

// Get all folders (including nested)
app.get('/api/folders', async (req, res) => {
  try {
    const getAllFolders = async (prefix = '') => {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
        Delimiter: '/',
      });

      const response = await s3Client.send(command);
      const folders = [];

      if (response.CommonPrefixes) {
        for (const commonPrefix of response.CommonPrefixes) {
          const folderPath = commonPrefix.Prefix?.replace(/\/$/, '');
          if (folderPath && folderPath !== 'Uncategorized') {
            folders.push(folderPath);
            // Recursively get subfolders
            const subfolders = await getAllFolders(commonPrefix.Prefix);
            folders.push(...subfolders);
          }
        }
      }

      return folders;
    };

    const folders = ['Uncategorized', ...(await getAllFolders())];
    res.json({ folders });
  } catch (error) {
    console.error('Error listing folders:', error);
    res.status(500).json({ error: 'Failed to list folders' });
  }
});

// List videos in a folder
app.get('/api/videos', async (req, res) => {
  try {
    const folder = req.query.folder || '';
    const prefix = folder && folder !== 'Uncategorized' ? `${folder}/` : '';

    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
    });

    const response = await s3Client.send(command);
    const videos = [];

    if (response.Contents) {
      for (const item of response.Contents) {
        if (item.Key && item.Key.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
          const keyParts = item.Key.split('/');
          const fileName = keyParts[keyParts.length - 1];
          // Get full folder path (everything except the filename)
          const folderName = keyParts.length > 1 ? keyParts.slice(0, -1).join('/') : 'Uncategorized';

          videos.push({
            key: item.Key,
            name: fileName,
            size: item.Size || 0,
            lastModified: item.LastModified,
            folder: folderName,
            url: `https://${CLOUDFRONT_DOMAIN}/${encodeURIComponent(item.Key).replace(/%2F/g, '/')}`,
          });
        }
      }
    }

    res.json({ videos });
  } catch (error) {
    console.error('Error listing videos:', error);
    res.status(500).json({ error: 'Failed to list videos' });
  }
});

// Upload video
app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Fix filename encoding (multer sometimes misinterprets UTF-8)
    const filename = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    
    const folder = req.body.folder || 'Uncategorized';
    const key = folder === 'Uncategorized' 
      ? filename 
      : `${folder}/${filename}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });

    await s3Client.send(command);

    res.json({ 
      success: true, 
      key,
      url: `https://${CLOUDFRONT_DOMAIN}/${encodeURIComponent(key).replace(/%2F/g, '/')}`
    });
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

// Delete video
app.delete('/api/videos/:key(*)', async (req, res) => {
  try {
    const key = req.params.key;

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// Rename video
app.put('/api/videos/:key(*)/rename', async (req, res) => {
  try {
    const oldKey = decodeURIComponent(req.params.key);
    const { newName } = req.body;

    console.log('=== RENAME VIDEO DEBUG ===');
    console.log('Raw req.params.key:', req.params.key);
    console.log('Decoded oldKey:', oldKey);
    console.log('New name:', newName);

    if (!newName) {
      return res.status(400).json({ error: 'New name is required' });
    }

    // Build new key with same folder path but new filename
    const keyParts = oldKey.split('/');
    keyParts[keyParts.length - 1] = newName;
    const newKey = keyParts.join('/');

    console.log('New key will be:', newKey);
    console.log('CopySource will be:', `${BUCKET_NAME}/${oldKey}`);

    // Copy to new key (CopySource must be URL-encoded)
    const copyCommand = new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      CopySource: encodeURIComponent(`${BUCKET_NAME}/${oldKey}`),
      Key: newKey,
    });

    await s3Client.send(copyCommand);
    console.log('Copy successful');

    // Delete old key
    const deleteCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: oldKey,
    });

    await s3Client.send(deleteCommand);
    console.log('Delete successful');

    res.json({ 
      success: true, 
      newKey,
      url: `https://${CLOUDFRONT_DOMAIN}/${encodeURIComponent(newKey).replace(/%2F/g, '/')}`
    });
  } catch (error) {
    console.error('Error renaming video:', error);
    res.status(500).json({ error: 'Failed to rename video', details: error.message });
  }
});

// Create folder
app.post('/api/folders', async (req, res) => {
  try {
    const { folderName } = req.body;

    if (!folderName) {
      return res.status(400).json({ error: 'Folder name required' });
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${folderName}/.keep`,
      Body: '',
    });

    await s3Client.send(command);
    res.json({ success: true });
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Rename folder
app.put('/api/folders/rename', async (req, res) => {
  try {
    const { oldName, newName } = req.body;

    if (!oldName || !newName) {
      return res.status(400).json({ error: 'Old and new folder names required' });
    }

    // List all objects in the old folder
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `${oldName}/`,
    });

    const listResponse = await s3Client.send(listCommand);

    if (listResponse.Contents) {
      // Copy each object to the new folder
      for (const item of listResponse.Contents) {
        if (!item.Key) continue;

        const newKey = item.Key.replace(`${oldName}/`, `${newName}/`);

        const copyCommand = new CopyObjectCommand({
          Bucket: BUCKET_NAME,
          CopySource: `${BUCKET_NAME}/${item.Key}`,
          Key: newKey,
        });

        await s3Client.send(copyCommand);

        // Delete the old object
        const deleteCommand = new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: item.Key,
        });

        await s3Client.send(deleteCommand);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error renaming folder:', error);
    res.status(500).json({ error: 'Failed to rename folder' });
  }
});

// Delete folder
app.delete('/api/folders/:folderName', async (req, res) => {
  try {
    const folderName = req.params.folderName;

    // List all objects in the folder
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `${folderName}/`,
    });

    const listResponse = await s3Client.send(listCommand);

    if (listResponse.Contents) {
      // Check if folder contains videos (excluding .keep files)
      const hasVideos = listResponse.Contents.some(item => 
        item.Key && 
        item.Key.match(/\.(mp4|webm|mov|avi|mkv)$/i)
      );

      if (hasVideos) {
        return res.status(400).json({ 
          error: 'Cannot delete folder that contains videos. Please delete or move all videos first.' 
        });
      }

      // Delete each object
      for (const item of listResponse.Contents) {
        if (!item.Key) continue;

        const deleteCommand = new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: item.Key,
        });

        await s3Client.send(deleteCommand);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
