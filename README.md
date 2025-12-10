# Video Manager - AWS S3 Integration

A React-based video file manager that allows users to upload videos to AWS S3, organize them in folders, and manage their video library.

## Features

-  **Video Upload**: Upload videos directly to AWS S3 bucket
-  **Folder Management**: Create and organize videos in folders
-  **Embed URLs**: Copy video URLs for embedding in video players
-  **Delete Videos**: Remove videos from S3 with confirmation
-  **Responsive Design**: Works on desktop and mobile devices
-  **Fast & Efficient**: Built with React and TypeScript

## Prerequisites

Before running this application, you need:

1. **AWS Account** with S3 access
2. **AWS S3 Bucket** created and configured
3. **AWS IAM User** with the following permissions:
   - s3:PutObject, s3:GetObject, s3:DeleteObject, s3:ListBucket

## Installation

Copy .env.example to .env and add your AWS credentials.

Run: npm install
Run: npm run dev

See full documentation in the project files.
