# Quick Start Guide - Video Manager

## Step 1: Configure AWS Credentials

1. Copy the example environment file:
   ```
   cp .env.example .env
   ```

2. Edit `.env` and fill in your AWS credentials:
   - `VITE_AWS_REGION` - Your AWS region (e.g., eu-west-3)
   - `VITE_AWS_BUCKET_NAME` - Your S3 bucket name
   - `VITE_AWS_ACCESS_KEY_ID` - Your AWS access key
   - `VITE_AWS_SECRET_ACCESS_KEY` - Your AWS secret key
   - `VITE_AWS_CUSTOM_DOMAIN` - (Optional) Custom domain for serving files (e.g., media.awakelab.world)

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

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

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

## Next Steps

For production deployment:
1. Set up AWS Cognito for authentication
2. Use temporary credentials via AWS STS
3. Implement backend API for S3 operations
4. Use signed URLs for secure access
5. Enable CloudFront for CDN delivery
