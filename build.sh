#!/bin/bash

# Render build script
# Install FFmpeg on Render

apt-get update
apt-get install -y ffmpeg

# Install backend dependencies
cd backend
npm install

echo "Build complete!"
