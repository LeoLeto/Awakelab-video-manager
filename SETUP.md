# Development Setup Guide

This project is split into two parts: **client** (frontend) and **server** (backend API).

## Step 1: Configure Backend (Server)

1. Navigate to the server directory and copy the example environment file:
   ```bash
   cd server
   cp .env.example .env
   ```

2. Edit `server/.env` and fill in your AWS credentials:
   - `AWS_REGION` - Your AWS region (e.g., eu-west-3)
   - `AWS_S3_BUCKET` - Your S3 bucket name
   - `AWS_ACCESS_KEY_ID` - Your AWS access key
   - `AWS_SECRET_ACCESS_KEY` - Your AWS secret key
   - `CLOUDFRONT_DOMAIN` - (Optional) Custom domain for serving files (e.g., media.awakelab.world)
   - `PORT` - Server port (default: 3001)

3. Install dependencies:
   ```bash
   npm install
   ```

## Step 2: Configure Frontend (Client)

1. Navigate to the client directory and copy the example environment file:
   ```bash
   cd ../client
   cp .env.example .env
   ```

2. Edit `client/.env`:
   - `VITE_API_URL` - Backend API URL (for development: http://localhost:3001/api)

3. Install dependencies:
   ```bash
   npm install
   ```

## Step 2: Set Up AWS S3 Bucket

### Create Bucket
1. Go to AWS S3 Console: https://console.aws.amazon.com/s3/
2. Click "Create bucket"
3. Enter a unique bucket name
4. Choose your region
5. Uncheck "Block all public access" (or configure per your security needs)
6. Click "Create bucket"

### Configure CORS
1. Select your bucket
2. Go to "Permissions" tab
3. Scroll to "Cross-origin resource sharing (CORS)"
4. Click "Edit" and paste:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": []
    }
]
```

### Create IAM User
1. Go to IAM Console: https://console.aws.amazon.com/iam/
2. Click "Users" → "Add users"
3. Create a new user
4. Attach policies:
   - AmazonS3FullAccess (or create custom policy with: s3:PutObject, s3:GetObject, s3:DeleteObject, s3:ListBucket)
5. Go to "Security credentials"
6. Click "Create access key"
7. Copy the Access Key ID and Secret Access Key

## Step 3: Run the Application

1. Start the backend server (in `server/` directory):
   ```bash
   cd server
   npm run dev
   ```
   Server will run on http://localhost:3001

2. In a new terminal, start the frontend (in `client/` directory):
   ```bash
   cd client
   npm run dev
   ```
   Frontend will run on http://localhost:5173

3. Open http://localhost:5173 in your browser.

## Step 4: Test the Features

1. **Create a folder**: Click "+ New Folder" in the sidebar
2. **Upload a video**: Click "Upload Video" button
3. **Copy video URL**: Click "Copy URL" on any video card
4. **Delete a video**: Click "Delete" and confirm

## Troubleshooting

### Upload fails
- Check AWS credentials in `.env`
- Verify bucket CORS configuration
- Ensure IAM user has proper permissions

### Videos don't appear
- Check browser console for errors
- Verify bucket name matches `.env`
- Check that videos were actually uploaded to S3

### Can't access videos
- Verify bucket permissions allow public read access
- Check CORS configuration
- Ensure region matches in `.env`

## Production Deployment

For production deployment on EC2 or other servers, see `server/README.md` for detailed instructions on:
- Setting up PM2 for the backend
- Configuring Nginx as a reverse proxy
- SSL certificate setup with Let's Encrypt
- Environment variable configuration
