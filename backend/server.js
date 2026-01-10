require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static HLS files
app.use('/videos', express.static(path.join(__dirname, 'uploads/hls'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.m3u8')) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    } else if (filePath.endsWith('.ts')) {
      res.setHeader('Content-Type', 'video/MP2T');
    }
  }
}));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api', uploadRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Adaptive Video Streaming Backend',
    version: '1.0.0',
    endpoints: {
      upload: 'POST /api/upload',
      health: 'GET /api/health'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`
    });
  }
  
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('===================================================');
  console.log('Adaptive Video Streaming Backend');
  console.log('===================================================');
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS enabled for: ${process.env.FRONTEND_URL || 'all origins'}`);
  console.log('===================================================');
});

module.exports = app;
