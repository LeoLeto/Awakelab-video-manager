# Backend Server Setup

This is the backend API server for Awakelab Video Manager. It handles all AWS S3 operations securely without exposing credentials to the frontend.

## Installation

```bash
cd server
npm install
```

## Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Edit `.env` with your AWS credentials:
```env
AWS_REGION=eu-west-3
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_S3_BUCKET=awakelab-videos
CLOUDFRONT_DOMAIN=media.awakelab.world
PORT=3001
```

## Development

```bash
npm run dev
```

Server will run on `http://localhost:3001`

## Production Deployment on EC2

### 1. Install Node.js (if not already installed)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### 3. Setup the server

```bash
cd /path/to/awakelab-video-manager/server
npm install
cp .env.example .env
nano .env  # Edit with your credentials
```

### 4. Start with PM2

```bash
pm2 start server.js --name awakelab-api
pm2 save
pm2 startup  # Follow the instructions to enable on boot
```

### 5. Configure Nginx as Reverse Proxy

Create `/etc/nginx/sites-available/awakelab-api`:

```nginx
server {
    listen 80;
    server_name api.your-domain.com;  # Use a subdomain for the API

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # CORS headers (if needed)
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'Content-Type';
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/awakelab-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Setup SSL

```bash
sudo certbot --nginx -d api.your-domain.com
```

### 7. Update Frontend

Update your frontend `.env` on EC2:

```env
VITE_API_URL=https://api.your-domain.com/api
```

Rebuild the frontend:

```bash
cd /path/to/awakelab-video-manager
npm run build
```

## API Endpoints

- `GET /api/folders` - List all folders
- `GET /api/videos?folder=xxx` - List videos in a folder
- `POST /api/upload` - Upload a video
- `DELETE /api/videos/:key` - Delete a video
- `POST /api/folders` - Create a folder
- `PUT /api/folders/rename` - Rename a folder
- `DELETE /api/folders/:folderName` - Delete a folder

## PM2 Commands

```bash
pm2 status              # Check status
pm2 logs awakelab-api   # View logs
pm2 restart awakelab-api # Restart server
pm2 stop awakelab-api   # Stop server
pm2 delete awakelab-api # Remove from PM2
```
