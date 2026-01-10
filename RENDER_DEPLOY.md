# Quick Deploy to Render

## Step-by-Step Render Deployment

### Prerequisites
- GitHub account
- Code pushed to GitHub repository
- Render account (free at https://render.com)

---

## Part 1: Deploy Backend

1. **Go to Render Dashboard**
   - Visit https://dashboard.render.com
   - Click "New +" button
   - Select "Web Service"

2. **Connect Repository**
   - Click "Connect account" for GitHub
   - Authorize Render
   - Select your repository

3. **Configure Backend Service**
   ```
   Name: video-streaming-backend
   Region: Oregon (or closest to you)
   Branch: main
   Root Directory: (leave empty)
   Environment: Node
   Build Command: cd backend && npm install
   Start Command: cd backend && node server.js
   Instance Type: Free (or Starter $7/mo for better performance)
   ```

4. **Add Environment Variables**
   Click "Advanced" → "Add Environment Variable":
   ```
   NODE_ENV = production
   FRONTEND_URL = (leave empty for now, update after frontend deploy)
   ```

5. **Add Persistent Disk** (Important!)
   - Scroll to "Disks" section
   - Click "Add Disk"
   ```
   Name: video-storage
   Mount Path: /opt/render/project/src/backend/uploads
   Size: 10 GB (free tier allows up to 1GB, paid allows more)
   ```

6. **Add Build Script for FFmpeg**
   - In your repository, ensure `build.sh` exists with:
   ```bash
   #!/bin/bash
   apt-get update
   apt-get install -y ffmpeg
   cd backend && npm install
   ```
   
   - Update Build Command to:
   ```
   bash build.sh
   ```

7. **Deploy!**
   - Click "Create Web Service"
   - Wait 5-10 minutes for deployment
   - Copy your backend URL (e.g., `https://video-streaming-backend.onrender.com`)

---

## Part 2: Deploy Frontend

1. **Create Static Site**
   - Click "New +" → "Static Site"
   - Connect same GitHub repository

2. **Configure Frontend**
   ```
   Name: video-streaming-frontend
   Branch: main
   Root Directory: (leave empty)
   Publish Directory: frontend
   Build Command: (leave empty)
   ```

3. **Deploy**
   - Click "Create Static Site"
   - Wait 2-3 minutes
   - Copy your frontend URL (e.g., `https://video-streaming-frontend.onrender.com`)

---

## Part 3: Update URLs

1. **Update Frontend API URL**
   - Edit `frontend/app.js`:
   ```javascript
   const API_URL = window.location.hostname === 'localhost' 
     ? 'http://localhost:3000/api' 
     : 'https://video-streaming-backend.onrender.com/api'; // Your backend URL
   ```

2. **Update Backend CORS**
   - In Render dashboard, go to backend service
   - Environment Variables → Edit `FRONTEND_URL`
   ```
   FRONTEND_URL = https://video-streaming-frontend.onrender.com
   ```

3. **Update Backend CORS in code** (already done)
   - File `backend/server.js` should have:
   ```javascript
   app.use(cors({
     origin: process.env.FRONTEND_URL || '*',
     methods: ['GET', 'POST'],
     allowedHeaders: ['Content-Type']
   }));
   ```

4. **Commit and push changes**
   ```bash
   git add .
   git commit -m "Update URLs for production"
   git push
   ```

5. **Render will auto-redeploy** both services

---

## Part 4: Test Your App

1. Visit your frontend URL: `https://video-streaming-frontend.onrender.com`
2. Upload a test video (small file recommended for first test)
3. Wait for transcoding (may take 30-60 seconds)
4. Video should play with quality selector

---

## Troubleshooting

### Backend won't start
- Check logs in Render dashboard
- Ensure FFmpeg installed: Add to build command
  ```
  apt-get update && apt-get install -y ffmpeg && cd backend && npm install
  ```

### Upload fails
- Check disk is mounted correctly: `/opt/render/project/src/backend/uploads`
- Verify file size < 100MB
- Check backend logs for FFmpeg errors

### CORS errors
- Ensure `FRONTEND_URL` environment variable matches your frontend URL exactly
- Include `https://` in the URL

### Videos don't play
- Check browser console for errors
- Verify HLS files created (check backend logs)
- Ensure video URL is accessible

---

## Cost Breakdown

### Free Tier
- Backend: 750 hours/month (sleeps after 15 min inactivity)
- Frontend: Unlimited
- Disk: 1 GB persistent storage
- **Total: $0/month**

### Paid Tier (Recommended)
- Backend Starter: $7/month (always on, 512 MB RAM)
- Frontend: Free
- Disk: 10 GB at $0.25/GB/month = $2.50/month
- **Total: ~$10/month**

---

## Pro Tips

1. **Free tier limitations:**
   - Backend sleeps after 15 min → First request takes 30s to wake
   - Use Starter plan ($7/mo) for always-on service

2. **Optimize for free tier:**
   - Keep videos small during development
   - Clean up old videos regularly
   - Monitor disk usage in Render dashboard

3. **Custom domain:**
   - Render allows custom domains on free tier
   - Add in Settings → Custom Domain

4. **Auto-deploy:**
   - Every push to `main` branch auto-deploys
   - Disable in Settings if needed

5. **Monitoring:**
   - View logs in real-time: Dashboard → Logs
   - Set up alerts for errors
   - Monitor disk usage

---

## Alternative: One-Click Deploy

Add this badge to your README for one-click deploy:

```markdown
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)
```

Create `render.yaml` (already in your repo):
```yaml
services:
  - type: web
    name: video-streaming-backend
    env: node
    buildCommand: bash build.sh
    startCommand: cd backend && node server.js
    disk:
      name: video-storage
      mountPath: /opt/render/project/src/backend/uploads
      sizeGB: 10
```

---

## Success!

Your adaptive video streaming pipeline is now live on Render! 

**Share your project:**
- Frontend URL: `https://your-app.onrender.com`
- Add to portfolio, resume, GitHub README
- Show in interviews as production deployment

**Next steps:**
- Add custom domain
- Set up monitoring
- Implement user authentication
- Add video management dashboard
