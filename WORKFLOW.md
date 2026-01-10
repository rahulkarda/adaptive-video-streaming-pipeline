# Project Workflow

Complete step-by-step workflow of the Adaptive Video Streaming Pipeline.

## System Architecture

```
[User Browser] → [Upload API] → [FFmpeg Processor] → [HLS Files] → [Streaming Player]
```

## Detailed Workflow

### 1. User Uploads Video

**Frontend (index.html + app.js):**
- User drags video file or clicks to select
- JavaScript validates file (type, size)
- FormData object created with video file
- AJAX POST request to `/api/upload`
- Progress bar displays upload status

**Code Flow:**
```
fileInput.addEventListener('change') 
  → validateFile() 
  → uploadVideo() 
  → fetch('/api/upload', FormData) 
  → Display progress
```

### 2. Backend Receives Upload

**Server (server.js):**
- Express server receives POST at `/api/upload`
- CORS middleware allows cross-origin requests
- Request logged with timestamp

**Upload Route (routes/upload.js):**
- Multer middleware intercepts multipart form data
- File type validation (MP4, MOV, AVI, WebM, MKV)
- File size validation (max 100MB)
- Saves to `uploads/temp/` with unique filename

**Code Flow:**
```
POST /api/upload 
  → CORS check 
  → Multer.diskStorage 
  → fileFilter validation 
  → Save to uploads/temp/{timestamp}-{filename}
```

### 3. FFmpeg Transcoding

**HLS Converter (hls-converter.js):**

**Step 3.1: Initialize Conversion**
- Create output directory: `uploads/hls/{videoName}/`
- Parse filename to get base name
- Call `convertToAdaptiveHLS()`

**Step 3.2: Process 360p Quality**
```javascript
ffmpeg(inputPath)
  .videoCodec('libx264')
  .audioCodec('aac')
  .size('640x360')
  .videoBitrate('800k')
  .audioBitrate('128k')
  .outputOptions([
    '-profile:v baseline',
    '-level 3.0',
    '-hls_time 10',        // 10-second segments
    '-hls_list_size 0',    // Include all segments
    '-f hls'
  ])
  .output('video_360p.m3u8')
  .run()
```

**Output:** 
- `video_360p.m3u8` (manifest)
- `video_360p0.ts`, `video_360p1.ts`, ... (segments)

**Step 3.3: Process 480p Quality**
```javascript
// Same process with:
.size('854x480')
.videoBitrate('1400k')
.output('video_480p.m3u8')
```

**Output:**
- `video_480p.m3u8`
- `video_480p0.ts`, `video_480p1.ts`, ...

**Step 3.4: Process 720p Quality**
```javascript
// Same process with:
.size('1280x720')
.videoBitrate('2800k')
.output('video_720p.m3u8')
```

**Output:**
- `video_720p.m3u8`
- `video_720p0.ts`, `video_720p1.ts`, ...

**Step 3.5: Create Master Playlist**
```javascript
function createMasterPlaylist() {
  const content = `
#EXTM3U
#EXT-X-VERSION:3

#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
video_360p.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=854x480
video_480p.m3u8

#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720
video_720p.m3u8
  `;
  
  fs.writeFileSync('video_master.m3u8', content);
}
```

**Step 3.6: Cleanup**
- Delete temp file from `uploads/temp/`
- Return success with manifest path

**Code Flow:**
```
convertToAdaptiveHLS() 
  → processQuality(360p) → FFmpeg encode → Save .m3u8 + .ts files
  → processQuality(480p) → FFmpeg encode → Save .m3u8 + .ts files  
  → processQuality(720p) → FFmpeg encode → Save .m3u8 + .ts files
  → createMasterPlaylist() → Save video_master.m3u8
  → cleanup() → Delete temp file
  → return { manifestPath, fileName, qualities }
```

### 4. Response to Frontend

**Upload Route:**
```javascript
res.json({
  success: true,
  message: "Video uploaded and converted to HLS successfully",
  fileName: "video.mp4",
  hlsUrl: "http://localhost:3000/videos/video/video_master.m3u8",
  manifestFile: "video_master.m3u8",
  size: 2440227,
  outputDir: "video"
});
```

**Frontend Receives:**
- Upload success message
- HLS manifest URL
- Calls `initPlayer(hlsUrl)`

### 5. HLS Player Initialization

**Player (player.js):**

**Step 5.1: Create HLS.js Instance**
```javascript
const hls = new Hls({
  debug: false,
  enableWorker: true,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  backBufferLength: 90
});
```

**Step 5.2: Load Master Manifest**
```javascript
hls.loadSource('http://localhost:3000/videos/video/video_master.m3u8');
hls.attachMedia(videoElement);
```

**Step 5.3: HLS.js Parses Master Playlist**
- Fetches `video_master.m3u8`
- Discovers 3 quality levels (360p, 480p, 720p)
- Fires `MANIFEST_PARSED` event

**Step 5.4: Populate Quality Selector**
```javascript
hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
  data.levels.forEach((level, index) => {
    qualitySelector.add(
      new Option(`${level.height}p (${level.bitrate/1000000} Mbps)`, index)
    );
  });
});
```

**Step 5.5: Auto Quality Selection**
- HLS.js measures network bandwidth
- Selects optimal starting quality (usually 360p)
- Loads variant playlist (e.g., `video_360p.m3u8`)

**Step 5.6: Segment Download**
```javascript
hls.on(Hls.Events.FRAG_LOADING, () => {
  // Download video_360p0.ts
  // Download video_360p1.ts
  // ...
});

hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
  // Calculate network speed
  const speedMbps = (bytes * 8 / time / 1000000);
  networkSpeed.textContent = `${speedMbps} Mbps`;
});
```

**Step 5.7: Playback Starts**
```javascript
videoElement.play();
```

### 6. Adaptive Bitrate Switching

**Continuous Monitoring:**

HLS.js monitors:
- Network download speed
- Buffer level
- Available bandwidth
- Dropped frames

**Quality Switch Decision:**
```javascript
if (networkSpeed > 2.5 Mbps && buffer > 10s) {
  switchTo(720p);
} else if (networkSpeed > 1.2 Mbps) {
  switchTo(480p);
} else {
  switchTo(360p);
}
```

**Switch Process:**
```javascript
hls.on(Hls.Events.LEVEL_SWITCHING, (event, data) => {
  console.log('Switching to level', data.level);
});

hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
  const level = hls.levels[data.level];
  currentResolution.textContent = `${level.width}x${level.height}`;
  currentBitrate.textContent = `${level.bitrate / 1000000} Mbps`;
  
  // Load new variant playlist
  fetch(`video_${level.height}p.m3u8`);
  
  // Download new quality segments
  // Continue playback seamlessly
});
```

### 7. Manual Quality Selection

**User Changes Quality:**
```javascript
qualitySelector.addEventListener('change', (e) => {
  const selectedLevel = parseInt(e.target.value);
  
  if (selectedLevel === -1) {
    hls.currentLevel = -1;  // Enable auto
  } else {
    hls.currentLevel = selectedLevel;  // Lock to specific quality
  }
});
```

**Effect:**
- Disables auto switching
- Immediately switches to selected quality
- Downloads new variant playlist
- Continues playback at new quality

### 8. Metrics Update Loop

**Every 1 Second:**
```javascript
setInterval(() => {
  // Buffer length
  const buffered = videoElement.buffered.end(0) - videoElement.currentTime;
  bufferLength.textContent = `${buffered.toFixed(1)}s`;
  
  // Current quality from HLS.js
  const level = hls.levels[hls.currentLevel];
  currentResolution.textContent = `${level.width}x${level.height}`;
  currentBitrate.textContent = `${(level.bitrate / 1000000).toFixed(2)} Mbps`;
  
  // Quality indicator
  if (hls.autoLevelEnabled) {
    currentQuality.textContent = `Auto (Level ${hls.currentLevel})`;
  } else {
    currentQuality.textContent = `Level ${hls.currentLevel}`;
  }
}, 1000);
```

## File Storage Structure

After upload and transcoding:

```
backend/uploads/
├── temp/                          (temporary, deleted after transcode)
│   └── 1234567890-video.mp4      (original upload)
│
└── hls/
    └── video/                     (permanent storage)
        ├── video_master.m3u8      (master playlist - entry point)
        ├── video_360p.m3u8        (360p variant playlist)
        ├── video_360p0.ts         (360p segment 0)
        ├── video_360p1.ts         (360p segment 1)
        ├── video_360p2.ts         ...
        ├── video_480p.m3u8        (480p variant playlist)
        ├── video_480p0.ts         (480p segments)
        ├── video_480p1.ts         ...
        ├── video_720p.m3u8        (720p variant playlist)
        ├── video_720p0.ts         (720p segments)
        └── video_720p1.ts         ...
```

## HTTP Requests Flow

### Initial Load
```
1. GET /                                    → index.html
2. GET /styles.css                          → CSS
3. GET /app.js                              → Upload logic
4. GET /player.js                           → Player logic
5. GET https://cdn.../hls.js                → HLS.js library
```

### Upload
```
6. POST /api/upload                         → Multipart form data
   Body: video file (binary)
   Response: { hlsUrl: "..." }
```

### Streaming
```
7. GET /videos/video/video_master.m3u8      → Master playlist
   Response:
   #EXTM3U
   #EXT-X-STREAM-INF:BANDWIDTH=800000...
   video_360p.m3u8
   ...

8. GET /videos/video/video_360p.m3u8        → Variant playlist
   Response:
   #EXTM3U
   #EXTINF:10.0,
   video_360p0.ts
   #EXTINF:10.0,
   video_360p1.ts
   ...

9. GET /videos/video/video_360p0.ts         → Segment 0
   Response: Binary video data

10. GET /videos/video/video_360p1.ts        → Segment 1
    Response: Binary video data

... (continues for all segments)

11. (if quality switches to 720p)
    GET /videos/video/video_720p.m3u8       → New variant
    GET /videos/video/video_720p0.ts        → New segments
    ...
```

## Error Handling

### Upload Errors
- **Invalid file type:** Rejected by Multer, 400 response
- **File too large:** Rejected by Multer, 400 response
- **Network error:** Frontend retry logic

### Transcoding Errors
- **FFmpeg not found:** Server startup fails
- **Encoding error:** Caught, logged, 500 response
- **Disk full:** FFmpeg fails, error logged

### Playback Errors
- **Network error:** HLS.js auto-retry
- **Media error:** HLS.js attempts recovery
- **Fatal error:** Display error message to user

## Performance Metrics

### Transcoding Time (10-second video)
- 360p: ~5-8 seconds
- 480p: ~7-10 seconds  
- 720p: ~10-15 seconds
- **Total:** ~25-35 seconds

### File Sizes (10-second video)
- Original (720p): ~1 MB
- 360p output: ~0.3 MB
- 480p output: ~0.5 MB
- 720p output: ~1.0 MB
- **Total HLS:** ~1.8 MB (including manifests and all qualities)

### Network Usage (streaming)
- Initial manifest: ~1 KB
- Per quality variant: ~0.5 KB
- Per segment (10s at 720p): ~350 KB
- **Bandwidth:** Matches selected quality (0.8 / 1.4 / 2.8 Mbps)

## Summary

The complete workflow is:

1. User uploads video → Frontend sends to backend
2. Backend saves to temp → Triggers FFmpeg
3. FFmpeg creates 3 qualities → Generates HLS files
4. Backend returns manifest URL → Frontend loads player
5. HLS.js fetches master playlist → Discovers qualities
6. Auto-selects starting quality → Downloads segments
7. Continuously monitors network → Switches quality as needed
8. User can manually override → Force specific quality
9. Metrics updated real-time → Display to user

All of this enables smooth, adaptive video streaming with automatic quality adjustment based on network conditions.
