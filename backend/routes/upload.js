const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { convertToAdaptiveHLS, generateThumbnail } = require('../hls-converter');

// Upload-specific rate limiter
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 uploads per 15 minutes
  message: {
    success: false,
    error: 'Too many upload requests from this IP, please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure multer for disk storage (needed for FFmpeg)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept video files only
    const allowedMimes = [
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'video/x-matroska'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'), false);
    }
  }
});

/**
 * POST /upload
 * Upload video and convert to HLS streaming format
 * Rate limited: 5 uploads per 15 minutes per IP
 */
router.post('/upload', uploadLimiter, upload.single('video'), async (req, res) => {
  let tempFilePath = null;
  let hlsOutputDir = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No video file provided'
      });
    }

    console.log(`Processing upload: ${req.file.originalname} (${req.file.size} bytes)`);

    tempFilePath = req.file.path;
    const baseName = path.parse(req.file.originalname).name;
    hlsOutputDir = path.join(__dirname, '../uploads/hls', baseName);

    // Convert to Adaptive HLS (multiple quality levels)
    console.log('Converting video to Adaptive HLS format...');
    const hlsResult = await convertToAdaptiveHLS(tempFilePath, hlsOutputDir, req.file.originalname);

    console.log(`Adaptive HLS conversion successful: ${hlsResult.fileName}`);
    console.log(`Quality levels: ${hlsResult.qualities.map(q => q.name).join(', ')}`);

    // Generate thumbnail
    const thumbnailPath = path.join(hlsOutputDir, 'thumbnail.jpg');
    let thumbnailUrl = null;
    try {
      await generateThumbnail(tempFilePath, thumbnailPath, 2);
      thumbnailUrl = `${process.env.NODE_ENV === 'production' 
        ? `${req.protocol}://${req.get('host')}`
        : `http://localhost:${process.env.PORT || 3000}`}/videos/${baseName}/thumbnail.jpg`;
      console.log('Thumbnail generated successfully');
    } catch (thumbError) {
      console.warn('Thumbnail generation failed:', thumbError.message);
      // Continue even if thumbnail fails
    }

    // Generate URL for HLS master manifest (works in both local and production)
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? `${req.protocol}://${req.get('host')}`
      : `http://localhost:${process.env.PORT || 3000}`;
    const hlsUrl = `${baseUrl}/videos/${baseName}/${hlsResult.fileName}`;

    res.json({
      success: true,
      message: 'Video uploaded and converted to HLS successfully',
      data: {
        fileName: req.file.originalname,
        hlsUrl: hlsUrl,
        manifestFile: hlsResult.fileName,
        thumbnailUrl: thumbnailUrl,
        size: req.file.size,
        outputDir: baseName
      }
    });

    // Clean up temp file after successful conversion
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log('Cleaned up temporary file');
    }

  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    if (hlsOutputDir && fs.existsSync(hlsOutputDir)) {
      fs.rmSync(hlsOutputDir, { recursive: true, force: true });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload video'
    });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
