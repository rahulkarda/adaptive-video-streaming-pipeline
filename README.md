# Adaptive Video Streaming Pipeline

A production-ready video streaming application with adaptive bitrate streaming using HLS (HTTP Live Streaming) protocol. Built with FFmpeg, Node.js, and HLS.js.

## Overview

This application allows users to upload videos which are automatically transcoded into multiple quality levels (360p, 480p, 720p) and streamed using HLS protocol with adaptive bitrate switching.

## Features

- Multi-quality video transcoding (360p, 480p, 720p)
- Adaptive bitrate streaming with HLS
- **Automatic thumbnail generation** (FFmpeg-based)
- Manual quality selection
- **Playback speed controls** (0.5x - 2x)
- **Picture-in-Picture mode**
- **Comprehensive keyboard shortcuts** (YouTube-style)
- Real-time streaming metrics (bitrate, resolution, buffer, network speed)
- **Rate limiting** (5 uploads per 15 min, 100 API requests per min)
- Drag-and-drop file upload
- Responsive modern UI
- Local file serving (no CDN required)

## Tech Stack

### Backend
- Node.js & Express.js
- FFmpeg (video transcoding & thumbnail extraction)
- fluent-ffmpeg (Node.js FFmpeg wrapper)
- Multer (file upload handling)
- express-rate-limit (API protection)

### Frontend
- Vanilla JavaScript
- HLS.js (adaptive streaming player)
- HTML5 Video API (PiP, playback speed)
- HTML5 & CSS3

## Architecture

```
Upload → FFmpeg Transcode → Multi-Quality (360p/480p/720p) → Local Storage → HLS.js Player
```

**Pipeline Flow:**
1. User uploads video via web interface
2. Multer saves video to temporary storage
3. FFmpeg transcodes video into 3 quality levels
4. HLS manifest (.m3u8) and segments (.ts) generated
5. Files stored locally in `backend/uploads/hls/`
6. HLS.js player streams with adaptive bitrate switching

## Installation

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)
- FFmpeg installed on system

### Install FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
Download from [ffmpeg.org](https://ffmpeg.org/download.html)

### Setup

1. Clone repository:
```bash
cd "Adaptive Video Streaming Pipeline"
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Create uploads directories:
```bash
mkdir -p uploads/temp uploads/hls
```

4. Start backend server:
```bash
npm start
```
Server runs on `http://localhost:3000`

5. Open frontend:
```bash
cd ../frontend
open index.html
```
Or use Live Server extension in VS Code

## Usage

1. Open frontend (`http://localhost:5500` with Live Server)
2. Drag and drop a video file or click to select
3. Wait for FFmpeg transcoding (shows progress in backend console)
4. Video automatically plays with adaptive streaming
5. **Automatic thumbnail generated** at 2 seconds
6. Use quality selector dropdown to manually choose quality
7. Monitor real-time metrics (resolution, bitrate, buffer, network speed)

### Player Controls

**Speed Control:**
- Click speed button (top-right) to cycle through speeds: 0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x
- Or press `S` keyboard shortcut

**Picture-in-Picture:**
- Click PiP button or press `P` to float video in small window

**Keyboard Shortcuts:**
- `Space` or `K` - Play/Pause
- `←` / `→` - Seek ±5 seconds
- `J` / `L` - Seek ±10 seconds
- `↑` / `↓` - Volume ±10%
- `M` - Mute/Unmute
- `F` - Fullscreen
- `P` - Picture-in-Picture
- `S` - Playback speed
- `0` or `Home` - Jump to start
- `End` - Jump to end

## Project Structure

```
.
├── README.md
├── DEPLOYMENT.md
├── RESUME.md
├── WORKFLOW.md
├── backend/
│   ├── server.js              # Express server with rate limiting
│   ├── hls-converter.js       # FFmpeg transcoding & thumbnail generation
│   ├── routes/
│   │   └── upload.js          # Upload endpoint with rate limiting
│   ├── uploads/
│   │   ├── temp/              # Temporary upload storage
│   │   └── hls/               # HLS output files + thumbnails
│   └── package.json
└── frontend/
    ├── index.html             # Main UI with player controls
    ├── styles.css             # Styling with control buttons
    ├── app.js                 # Upload handling
    ├── player.js              # HLS.js player logic
    └── player-controls.js     # Speed, PiP, keyboard shortcuts
```

## API Endpoints

### POST /api/upload
Upload video for transcoding

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: `video` file (max 100MB)

**Response:**
```json
{
  "success": true,
  "message": "Video uploaded and converted to HLS successfully",
  "data": {
    "fileName": "video.mp4",
    "hlsUrl": "http://localhost:3000/videos/video/video_master.m3u8",
    "thumbnailUrl": "http://localhost:3000/videos/video/thumbnail.jpg",
    "manifestFile": "video_master.m3u8",
    "size": 2440227,
    "outputDir": "video"
  }
}
```

**Rate Limits:**
- 5 uploads per 15 minutes per IP
- Returns 429 status if exceeded

### GET /videos/:videoName/:file
Serve HLS manifest and segment files

## Configuration

### Backend (server.js)
- Port: `3000` (default)
- CORS: Enabled for all origins
- Upload limit: 100MB
- Supported formats: MP4, MOV, AVI, WebM, MKV

### FFmpeg Transcoding (hls-converter.js)
- Video codec: H.264 (libx264)
- Audio codec: AAC
- Segment duration: 10 seconds
- Quality levels:
  - 360p: 640x360 @ 800 kbps
  - 480p: 854x480 @ 1400 kbps
  - 720p: 1280x720 @ 2800 kbps

### HLS.js Player (player.js)
- Max buffer length: 30 seconds
- Back buffer: 90 seconds
- Auto quality switching enabled
- Manual quality selection available

## Troubleshooting

**FFmpeg not found:**
```bash
which ffmpeg  # Verify installation
ffmpeg -version  # Check version
```

**Port 3000 already in use:**
```bash
lsof -ti:3000 | xargs kill -9  # Kill process on port 3000
```

**Video not playing:**
- Check backend console for FFmpeg errors
- Verify HLS files created in `backend/uploads/hls/`
- Check browser console for HLS.js errors
- Ensure video format is supported (MP4 recommended)

**Slow transcoding:**
- Transcoding time depends on video length and system CPU
- 10-second video: ~15-30 seconds
- 1-minute video: ~2-3 minutes
- Progress shown in backend console

## Development

**Watch backend logs:**
```bash
cd backend
npm start
```

**Test upload:**
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "video=@test.mp4"
```

**Verify HLS output:**
```bash
ls -la backend/uploads/hls/video-name/
# Should see: *_master.m3u8, *_360p.m3u8, *_480p.m3u8, *_720p.m3u8, *.ts
```

## Performance

- Transcoding: CPU-intensive, runs sequentially (360p → 480p → 720p)
- Streaming: Efficient, HLS.js handles buffering and quality switching
- Storage: ~3x original file size (3 quality levels)
- Network: Adaptive bitrate adjusts to user bandwidth

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Native HLS support (HLS.js fallback)
- Mobile: iOS Safari, Chrome Android supported

## License

MIT

## Author

Built as a portfolio project demonstrating full-stack video streaming implementation.
