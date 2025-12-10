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

// CORS configuration
app.use(cors());
app.use(express.json());

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

// Get all folders
app.get('/api/folders', async (req, res) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Delimiter: '/',
    });

    const response = await s3Client.send(command);
    const folders = ['Uncategorized'];

    if (response.CommonPrefixes) {
      response.CommonPrefixes.forEach((prefix) => {
        const folderName = prefix.Prefix?.replace('/', '');
        if (folderName) {
          folders.push(folderName);
        }
      });
    }

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
          const folderName = keyParts.length > 1 ? keyParts[0] : 'Uncategorized';

          videos.push({
            key: item.Key,
            name: fileName,
            size: item.Size || 0,
            lastModified: item.LastModified,
            folder: folderName,
            url: `https://${CLOUDFRONT_DOMAIN}/${item.Key}`,
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

    const folder = req.body.folder || 'Uncategorized';
    const key = folder === 'Uncategorized' 
      ? req.file.originalname 
      : `${folder}/${req.file.originalname}`;

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
      url: `https://${CLOUDFRONT_DOMAIN}/${key}`
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
