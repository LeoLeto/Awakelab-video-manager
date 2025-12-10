# Awakelab Video Manager

A full-stack video management application with AWS S3 integration and folder organization.

## Project Structure

```
awakelab-video-manager/
├── client/          # React + TypeScript frontend
└── server/          # Express.js backend API
```

## Quick Start

### Prerequisites
- Node.js 20+
- AWS S3 bucket configured
- AWS credentials with S3 access

### Development Setup

1. **Clone the repository**
```bash
git clone https://github.com/LeoLeto/Awakelab-video-manager.git
cd Awakelab-video-manager
```

2. **Setup Backend**
```bash
cd server
npm install
cp .env.example .env
# Edit .env with your AWS credentials
npm run dev
```

3. **Setup Frontend** (in a new terminal)
```bash
cd client
npm install
cp .env.example .env
# Edit .env with VITE_API_URL=http://localhost:3001/api
npm run dev
```

4. **Open browser**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

## Features

- 📁 Folder organization for videos
- ⬆️ Video upload with progress tracking
- 🗑️ Delete videos and folders
- ✏️ Rename folders
- 📋 Copy embed URLs
- 💾 Smart caching for instant folder switching
- 🔒 Secure AWS credentials on backend

## Production Deployment

See detailed deployment instructions in:
- Frontend: See SETUP.md
- Backend: `server/README.md`

## Tech Stack

### Frontend
- React 18
- TypeScript
- Vite
- REST API client

### Backend
- Node.js
- Express.js
- AWS SDK v3
- Multer for file uploads

## License

MIT
