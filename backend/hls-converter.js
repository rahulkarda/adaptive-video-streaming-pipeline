const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

/**
 * Convert video to HLS format with multiple quality levels
 * @param {string} inputPath - Path to input video file
 * @param {string} outputDir - Directory for HLS output files
 * @param {string} fileName - Base filename for output
 * @returns {Promise<Object>} Conversion result with manifest path
 */
function convertToHLS(inputPath, outputDir, fileName) {
  return new Promise((resolve, reject) => {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const baseName = path.parse(fileName).name;
    const manifestPath = path.join(outputDir, `${baseName}.m3u8`);

    console.log(`Converting ${fileName} to HLS...`);
    console.log(`Output: ${manifestPath}`);

    // FFmpeg HLS conversion with multiple quality levels
    ffmpeg(inputPath)
      // Video codec settings
      .videoCodec('libx264')
      .audioCodec('aac')
      
      // Output options for HLS
      .outputOptions([
        '-profile:v baseline', // Baseline profile for compatibility
        '-level 3.0',
        '-start_number 0',
        '-hls_time 10', // 10 second segments
        '-hls_list_size 0', // Include all segments
        '-f hls' // HLS format
      ])
      
      // Output file
      .output(manifestPath)
      
      // Event handlers
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine);
      })
      
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`Processing: ${Math.round(progress.percent)}% done`);
        }
      })
      
      .on('end', () => {
        console.log('HLS conversion completed successfully');
        resolve({
          success: true,
          manifestPath: manifestPath,
          outputDir: outputDir,
          fileName: `${baseName}.m3u8`
        });
      })
      
      .on('error', (err, stdout, stderr) => {
        console.error('FFmpeg error:', err.message);
        console.error('FFmpeg stderr:', stderr);
        reject(new Error(`FFmpeg conversion failed: ${err.message}`));
      })
      
      .run();
  });
}

/**
 * Convert video to HLS with adaptive bitrate (multiple quality levels)
 * @param {string} inputPath - Path to input video file
 * @param {string} outputDir - Directory for HLS output files
 * @param {string} fileName - Base filename for output
 * @returns {Promise<Object>} Conversion result
 */
function convertToAdaptiveHLS(inputPath, outputDir, fileName) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const baseName = path.parse(fileName).name;
    const manifestPath = path.join(outputDir, `${baseName}_master.m3u8`);

    console.log(`Converting ${fileName} to Adaptive HLS...`);

    // Create multiple quality variants
    const qualities = [
      { name: '360p', width: 640, height: 360, bitrate: '800k' },
      { name: '480p', width: 854, height: 480, bitrate: '1400k' },
      { name: '720p', width: 1280, height: 720, bitrate: '2800k' }
    ];

    const variantPlaylists = [];

    // Process each quality level
    const processQuality = (index) => {
      if (index >= qualities.length) {
        // All qualities processed, create master playlist
        createMasterPlaylist(manifestPath, variantPlaylists, baseName);
        resolve({
          success: true,
          manifestPath: manifestPath,
          outputDir: outputDir,
          fileName: `${baseName}_master.m3u8`,
          qualities: qualities
        });
        return;
      }

      const quality = qualities[index];
      const outputFile = path.join(outputDir, `${baseName}_${quality.name}.m3u8`);

      console.log(`Processing ${quality.name}...`);

      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size(`${quality.width}x${quality.height}`)
        .videoBitrate(quality.bitrate)
        .audioBitrate('128k')
        .outputOptions([
          '-profile:v baseline',
          '-level 3.0',
          '-start_number 0',
          '-hls_time 10',
          '-hls_list_size 0',
          '-f hls'
        ])
        .output(outputFile)
        .on('end', () => {
          console.log(`${quality.name} completed`);
          variantPlaylists.push({
            name: quality.name,
            file: `${baseName}_${quality.name}.m3u8`,
            bandwidth: parseInt(quality.bitrate) * 1000,
            resolution: `${quality.width}x${quality.height}`
          });
          processQuality(index + 1);
        })
        .on('error', (err) => {
          console.error(`Error processing ${quality.name}:`, err.message);
          reject(err);
        })
        .run();
    };

    processQuality(0);
  });
}

/**
 * Create master playlist for adaptive streaming
 * @param {string} masterPath - Path to master playlist file
 * @param {Array} variants - Array of variant playlist info
 * @param {string} baseName - Base filename
 */
function createMasterPlaylist(masterPath, variants, baseName) {
  let content = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

  variants.forEach(variant => {
    content += `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bandwidth},RESOLUTION=${variant.resolution}\n`;
    content += `${variant.file}\n`;
  });

  fs.writeFileSync(masterPath, content);
  console.log('Master playlist created:', masterPath);
}

/**
 * Clean up temporary files
 * @param {string} directory - Directory to clean
 */
function cleanup(directory) {
  if (fs.existsSync(directory)) {
    fs.rmSync(directory, { recursive: true, force: true });
    console.log('Cleaned up:', directory);
  }
}

/**
 * Generate thumbnail from video
 * @param {string} inputPath - Path to input video file
 * @param {string} outputPath - Path for thumbnail output
 * @param {number} timeInSeconds - Time position to capture (default: 2 seconds)
 * @returns {Promise<string>} Path to generated thumbnail
 */
function generateThumbnail(inputPath, outputPath, timeInSeconds = 2) {
  return new Promise((resolve, reject) => {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Generating thumbnail at ${timeInSeconds}s...`);

    ffmpeg(inputPath)
      .screenshots({
        timestamps: [timeInSeconds],
        filename: path.basename(outputPath),
        folder: outputDir,
        size: '320x180' // 16:9 aspect ratio thumbnail
      })
      .on('end', () => {
        console.log('Thumbnail generated:', outputPath);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Error generating thumbnail:', err.message);
        reject(err);
      });
  });
}

module.exports = {
  convertToHLS,
  convertToAdaptiveHLS,
  generateThumbnail,
  cleanup
};
