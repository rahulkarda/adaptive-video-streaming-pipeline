# Deployment Guide

Simple deployment guide for Adaptive Video Streaming Pipeline.

## Quick Deploy Options

### Option 1: Render (Recommended - Free Tier Available)

**Why Render:**
- Free tier includes 750 hours/month
- Built-in FFmpeg support
- Persistent disk storage
- Auto-deploys from Git
- Simple setup

**Steps:**

1. **Push code to GitHub** (if not already done)

2. **Create Render account** at https://render.com

3. **Deploy Backend:**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Settings:
     - Name: `video-streaming-backend`
     - Environment: `Node`
     - Build Command: `cd backend && npm install && apt-get update && apt-get install -y ffmpeg`
     - Start Command: `cd backend && node server.js`
     - Instance Type: `Free` or `Starter ($7/mo)`
   - Add Disk:
     - Name: `video-storage`
     - Mount Path: `/opt/render/project/src/backend/uploads`
     - Size: 10 GB
   - Environment Variables:
     - `NODE_ENV` = `production`
     - `PORT` = `10000` (auto-set by Render)
     - `FRONTEND_URL` = `https://your-frontend.onrender.com`

4. **Deploy Frontend:**
   - Click "New +" → "Static Site"
   - Connect same GitHub repository
   - Settings:
     - Name: `video-streaming-frontend`
     - Publish Directory: `frontend`
     - No build command needed

5. **Update frontend API URL:**
   - In `frontend/app.js`, change:
   ```javascript
   const API_URL = 'https://video-streaming-backend.onrender.com';
   ```

6. **Done!** Your app is live at:
   - Frontend: `https://video-streaming-frontend.onrender.com`
   - Backend: `https://video-streaming-backend.onrender.com`

**Important Notes:**
- Free tier sleeps after 15 min of inactivity (first request takes ~30s to wake)
- Upgrade to Starter ($7/mo) for always-on service
- Disk storage persists between deploys

---

### Option 2: Railway (Alternative - $5/month)

**Why Railway:**
- $5 credit free
- Automatic FFmpeg installation
- Simple deployment
- Good for portfolio projects

**Steps:**

1. Visit https://railway.app
2. Click "Start a New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Add service:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `node server.js`
6. Railway auto-installs FFmpeg
7. Deploy frontend separately or use same service

---

### Option 3: Traditional VPS (Full Control)

This is for advanced users who want complete control.

## Deployment Options

### Option 1: Traditional VPS (DigitalOcean, Linode, AWS EC2)

**Requirements:**
- Ubuntu 20.04+ or equivalent
- 2GB+ RAM
- 20GB+ storage
- Node.js 18+
- FFmpeg

**Setup Steps:**

1. Install dependencies:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install FFmpeg
sudo apt install -y ffmpeg

# Verify installations
node --version
npm --version
ffmpeg -version
```

2. Clone and setup application:
```bash
cd /var/www
git clone <your-repo-url> video-streaming
cd video-streaming/backend
npm install
mkdir -p uploads/temp uploads/hls
```

3. Configure environment:
```bash
# Create .env file
cat > .env << EOF
PORT=3000
FRONTEND_URL=https://yourdomain.com
NODE_ENV=production
EOF
```

4. Setup PM2 for process management:
```bash
sudo npm install -g pm2
pm2 start server.js --name video-streaming
pm2 startup
pm2 save
```

5. Configure Nginx reverse proxy:
```bash
sudo apt install -y nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/video-streaming
```

Add configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        root /var/www/video-streaming/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 100M;
    }

    # HLS video files
    location /videos {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        
        # CORS headers for HLS
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, OPTIONS';
        add_header Access-Control-Allow-Headers 'Range';
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/video-streaming /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

6. Setup SSL with Let's Encrypt:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

7. Configure firewall:
```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

### Option 2: Docker Deployment

**Dockerfile:**
```dockerfile
FROM node:18-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy backend
COPY backend/package*.json ./
RUN npm install --production

COPY backend/ ./

# Create upload directories
RUN mkdir -p uploads/temp uploads/hls

EXPOSE 3000

CMD ["node", "server.js"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./backend/uploads:/app/uploads
    environment:
      - PORT=3000
      - NODE_ENV=production
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./frontend:/usr/share/nginx/html
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - backend
    restart: unless-stopped
```

**Deploy:**
```bash
docker-compose up -d
```

### Option 3: AWS (Comprehensive)

**Architecture:**
- EC2: Run Node.js backend with FFmpeg
- S3: Store HLS files (optional)
- CloudFront: CDN for video delivery (optional)
- Route 53: DNS management

**Steps:**

1. Launch EC2 instance (t3.medium recommended)
2. Install Node.js and FFmpeg (see VPS steps)
3. Create S3 bucket for HLS storage (optional)
4. Setup CloudFront distribution (optional)
5. Configure security groups for ports 80, 443, 3000

## Production Checklist

- [ ] FFmpeg installed and verified
- [ ] Node.js 18+ installed
- [ ] File upload directories created with proper permissions
- [ ] Process manager (PM2) configured
- [ ] Reverse proxy (Nginx) configured
- [ ] SSL certificate installed
- [ ] Firewall rules configured
- [ ] CORS headers properly set
- [ ] File size limits configured (100MB default)
- [ ] Disk space monitoring enabled
- [ ] Backup strategy for uploaded videos
- [ ] Error logging configured
- [ ] Health check endpoint tested

## Monitoring

**PM2 monitoring:**
```bash
pm2 monit
pm2 logs video-streaming
```

**Disk usage:**
```bash
du -sh /var/www/video-streaming/backend/uploads/hls/
```

**Nginx logs:**
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## Scaling Considerations

**CPU:**
- FFmpeg transcoding is CPU-intensive
- Consider worker queue (Bull/Redis) for async processing
- Vertical scaling: Increase CPU cores

**Storage:**
- HLS files grow with uploads (3x original size)
- Implement cleanup for old videos
- Consider object storage (S3) for production

**Network:**
- CDN recommended for global users
- CloudFront, Cloudflare, or Fastly

## Cleanup Script

Auto-delete old videos:
```javascript
// cleanup.js
const fs = require('fs');
const path = require('path');

const hlsDir = './uploads/hls';
const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

fs.readdir(hlsDir, (err, folders) => {
  folders.forEach(folder => {
    const folderPath = path.join(hlsDir, folder);
    const stats = fs.statSync(folderPath);
    
    if (Date.now() - stats.mtime.getTime() > maxAge) {
      fs.rmSync(folderPath, { recursive: true });
      console.log(`Deleted: ${folder}`);
    }
  });
});
```

**Cron job:**
```bash
# Run cleanup daily at 3 AM
0 3 * * * cd /var/www/video-streaming/backend && node cleanup.js
```

## Security

1. **Rate limiting:**
```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // 5 uploads per 15 min
});

app.post('/api/upload', uploadLimiter, uploadRoutes);
```

2. **Authentication (optional):**
   - Add JWT authentication for uploads
   - Implement user accounts
   - Track upload quotas

## Cost Estimates

**VPS (DigitalOcean/Linode):**
- Basic Droplet: $12/month (2GB RAM, 50GB storage)
- Better: $24/month (4GB RAM, 80GB storage)

**AWS:**
- EC2 t3.medium: ~$30/month
- S3 storage: ~$0.023/GB/month
- CloudFront: ~$0.085/GB transferred
- Estimated: $50-100/month (moderate usage)

**Domain + SSL:**
- Domain: $10-15/year
- SSL: Free (Let's Encrypt)

## Support

For deployment issues:
1. Check backend logs: `pm2 logs`
2. Check Nginx logs: `/var/log/nginx/error.log`
3. Verify FFmpeg: `ffmpeg -version`
4. Test upload endpoint: `curl -X POST http://localhost:3000/api/upload -F "video=@test.mp4"`
