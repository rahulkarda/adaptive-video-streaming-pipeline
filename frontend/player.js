// Player state
let hls = null;
let videoElement = null;
let metricsInterval = null;
let eventLogItems = [];
let lastLoadedBytes = 0;
let lastLoadTime = Date.now();
let speedSamples = [];
const MAX_SPEED_SAMPLES = 5;

// DOM Elements
const loadingOverlay = document.getElementById('loadingOverlay');
const currentQuality = document.getElementById('currentQuality');
const currentResolution = document.getElementById('currentResolution');
const currentBitrate = document.getElementById('currentBitrate');
const bufferLength = document.getElementById('bufferLength');
const playbackState = document.getElementById('playbackState');
const networkSpeed = document.getElementById('networkSpeed');
const eventLog = document.getElementById('eventLog');
const qualitySelector = document.getElementById('qualitySelector');

/**
 * Initialize HLS player
 * @param {string} hlsUrl - HLS manifest URL
 * @param {string} fileName - Original filename
 */
window.initPlayer = function(hlsUrl, fileName) {
    videoElement = document.getElementById('videoPlayer');
    
    console.log('Initializing player with URL:', hlsUrl);
    addEventLog('Initializing video player...', 'info');

    // Check if URL is an HLS manifest (.m3u8) or regular video
    if (hlsUrl.includes('.m3u8')) {
        // HLS streaming
        if (Hls.isSupported()) {
            setupHlsPlayer(hlsUrl);
        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            setupNativePlayer(hlsUrl);
        } else {
            handlePlayerError('HLS is not supported in this browser');
        }
    } else {
        // Regular video file (MP4, etc.)
        setupDirectPlayer(hlsUrl);
    }

    // Setup video event listeners
    setupVideoListeners();
    
    // Start metrics monitoring
    startMetricsMonitoring();
};

/**
 * Setup direct video player (for MP4, WebM, etc.)
 * @param {string} url - Video URL
 */
function setupDirectPlayer(url) {
    console.log('Using direct video playback');
    addEventLog('Loading video from CDN...', 'info');
    
    videoElement.src = url;
    
    videoElement.addEventListener('loadedmetadata', () => {
        hideLoadingOverlay();
        addEventLog('Video loaded successfully', 'quality-change');
        
        // Update metrics with video info
        const width = videoElement.videoWidth;
        const height = videoElement.videoHeight;
        currentResolution.textContent = `${width}x${height}`;
        currentQuality.textContent = 'Original';
        addEventLog(`Resolution: ${width}x${height}`, 'info');
    });
    
    videoElement.addEventListener('canplay', () => {
        videoElement.play().catch(e => {
            console.log('Auto-play prevented:', e);
            playbackState.textContent = 'Click to play';
        });
    });
}

/**
 * Setup HLS.js player
 * @param {string} url - HLS URL
 */
function setupHlsPlayer(url) {
    hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
    });

    // Load source
    hls.loadSource(url);
    hls.attachMedia(videoElement);

    // HLS Events
    hls.on(Hls.Events.MANIFEST_PARSED, function(event, data) {
        console.log('Manifest loaded, found ' + data.levels.length + ' quality levels');
        addEventLog(`Manifest loaded: ${data.levels.length} quality levels available`, 'quality-change');
        
        // Populate quality selector
        populateQualitySelector(data.levels);
        
        // Log available qualities
        data.levels.forEach((level, index) => {
            console.log(`Level ${index}: ${level.width}x${level.height} @ ${Math.round(level.bitrate / 1000)} kbps`);
        });
        
        hideLoadingOverlay();
        videoElement.play().catch(e => {
            console.log('Auto-play prevented:', e);
            playbackState.textContent = 'Click to play';
        });
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, function(event, data) {
        const level = hls.levels[data.level];
        console.log('Quality switched to:', level);
        
        const resolution = `${level.width}x${level.height}`;
        const bitrate = (level.bitrate / 1000000).toFixed(2);
        
        currentResolution.textContent = resolution;
        currentBitrate.textContent = `${bitrate} Mbps`;
        
        addEventLog(`Quality switched: ${resolution} @ ${bitrate} Mbps`, 'quality-change');
        updateQualityInfo(data.level);
    });

    hls.on(Hls.Events.LEVEL_LOADING, function(event, data) {
        console.log('Loading level:', data.level);
    });

    hls.on(Hls.Events.ERROR, function(event, data) {
        console.error('HLS Error:', data);
        
        if (data.fatal) {
            switch(data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                    console.log('Fatal network error, trying to recover...');
                    addEventLog('Network error, attempting recovery...', 'error');
                    hls.startLoad();
                    break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                    console.log('Fatal media error, trying to recover...');
                    addEventLog('Media error, attempting recovery...', 'error');
                    hls.recoverMediaError();
                    break;
                default:
                    handlePlayerError('Fatal error: ' + data.type);
                    break;
            }
        }
    });

    // Buffer events
    hls.on(Hls.Events.FRAG_BUFFERED, function(event, data) {
        console.log('Fragment buffered:', data.frag.sn);
    });

    // Loading events
    hls.on(Hls.Events.FRAG_LOADING, function(event, data) {
        playbackState.textContent = 'Loading...';
    });

    hls.on(Hls.Events.FRAG_LOADED, function(event, data) {
        playbackState.textContent = 'Playing';
        
        // Calculate network speed from fragment load stats
        if (data.frag && data.frag.stats) {
            const stats = data.frag.stats;
            const loadTimeMs = stats.loading.end - stats.loading.start;
            const bytesLoaded = stats.loaded;
            
            if (bytesLoaded > 0 && loadTimeMs > 0) {
                // Calculate speed in Mbps (bytes * 8 bits/byte / time in ms * 1000 ms/s / 1000000 bits/Mbps)
                const speedMbps = parseFloat(((bytesLoaded * 8) / loadTimeMs / 1000).toFixed(2));
                
                // Add to samples for moving average
                speedSamples.push(speedMbps);
                if (speedSamples.length > MAX_SPEED_SAMPLES) {
                    speedSamples.shift();
                }
                
                // Calculate average speed
                const avgSpeed = (speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length).toFixed(2);
                networkSpeed.textContent = `${avgSpeed} Mbps`;
                
                // Track for averaging
                lastLoadedBytes = bytesLoaded;
                lastLoadTime = Date.now();
            }
        }
    });
}

/**
 * Setup native HLS player (Safari)
 * @param {string} url - HLS URL
 */
function setupNativePlayer(url) {
    console.log('Using native HLS support');
    addEventLog('Using native HLS support (Safari)', 'info');
    
    videoElement.src = url;
    
    videoElement.addEventListener('loadedmetadata', () => {
        hideLoadingOverlay();
        addEventLog('Video loaded successfully', 'quality-change');
    });
}

/**
 * Setup video element event listeners
 */
function setupVideoListeners() {
    videoElement.addEventListener('playing', () => {
        playbackState.textContent = 'Playing';
        addEventLog('Playback started', 'info');
    });

    videoElement.addEventListener('pause', () => {
        playbackState.textContent = 'Paused';
    });

    videoElement.addEventListener('waiting', () => {
        playbackState.textContent = 'Buffering...';
        addEventLog('Buffering...', 'buffering');
    });

    videoElement.addEventListener('ended', () => {
        playbackState.textContent = 'Ended';
        addEventLog('Playback ended', 'info');
    });

    videoElement.addEventListener('error', (e) => {
        console.error('Video error:', e);
        handlePlayerError('Video playback error');
    });

    videoElement.addEventListener('loadstart', () => {
        playbackState.textContent = 'Loading...';
    });

    videoElement.addEventListener('canplay', () => {
        playbackState.textContent = 'Ready';
    });
}

/**
 * Start monitoring playback metrics
 */
function startMetricsMonitoring() {
    metricsInterval = setInterval(() => {
        if (!videoElement) return;

        // Update buffer length
        if (videoElement.buffered.length > 0) {
            const buffered = videoElement.buffered.end(videoElement.buffered.length - 1) - videoElement.currentTime;
            bufferLength.textContent = buffered.toFixed(1) + 's';
        }

        // Update quality info from HLS.js
        if (hls) {
            const currentLevel = hls.currentLevel;
            if (currentLevel >= 0) {
                const level = hls.levels[currentLevel];
                if (level) {
                    currentResolution.textContent = `${level.width}x${level.height}`;
                    currentBitrate.textContent = `${(level.bitrate / 1000000).toFixed(2)} Mbps`;
                }
            }

            // Check if auto level selection is enabled
            if (hls.autoLevelEnabled) {
                currentQuality.textContent = 'Auto';
            } else {
                currentQuality.textContent = `Level ${hls.currentLevel}`;
            }
        }

    }, 1000);
}

/**
 * Update quality information
 * @param {number} levelIndex - Current quality level index
 */
function updateQualityInfo(levelIndex) {
    if (!hls || !hls.levels[levelIndex]) return;
    
    const level = hls.levels[levelIndex];
    
    if (hls.autoLevelEnabled) {
        currentQuality.textContent = `Auto (Level ${levelIndex})`;
    } else {
        currentQuality.textContent = `Level ${levelIndex}`;
    }
}

/**
 * Add event to log
 * @param {string} message - Event message
 * @param {string} type - Event type
 */
function addEventLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    
    eventLogItems.unshift(logMessage);
    
    // Keep only last 10 events
    if (eventLogItems.length > 10) {
        eventLogItems = eventLogItems.slice(0, 10);
    }
    
    // Update UI
    eventLog.innerHTML = eventLogItems
        .map(item => `<div class="event-item ${type}">${item}</div>`)
        .join('');
}

/**
 * Hide loading overlay
 */
function hideLoadingOverlay() {
    setTimeout(() => {
        loadingOverlay.style.display = 'none';
    }, 500);
}

/**
 * Handle player errors
 * @param {string} errorMessage - Error message
 */
function handlePlayerError(errorMessage) {
    console.error('Player error:', errorMessage);
    addEventLog(`Error: ${errorMessage}`, 'error');
    playbackState.textContent = 'Error';
    
    // Show error in UI
    alert('Player Error: ' + errorMessage);
}

/**
 * Stop player and cleanup
 */
window.stopPlayer = function() {
    if (hls) {
        hls.destroy();
        hls = null;
    }
    
    if (metricsInterval) {
        clearInterval(metricsInterval);
        metricsInterval = null;
    }
    
    if (videoElement) {
        videoElement.pause();
        videoElement.src = '';
    }
    
    // Reset UI
    currentQuality.textContent = 'Auto';
    currentResolution.textContent = '-';
    currentBitrate.textContent = '- Mbps';
    bufferLength.textContent = '0s';
    playbackState.textContent = 'Ready';
    networkSpeed.textContent = '-';
    eventLog.innerHTML = '<div class="event-item">Waiting for events...</div>';
    eventLogItems = [];
    
    // Reset quality selector
    if (qualitySelector) {
        qualitySelector.innerHTML = '<option value="-1">Auto</option>';
    }
    
    loadingOverlay.style.display = 'flex';
};

/**
 * Populate quality selector with available levels
 * @param {Array} levels - Available quality levels
 */
function populateQualitySelector(levels) {
    if (!qualitySelector) return;
    
    // Clear existing options
    qualitySelector.innerHTML = '<option value="-1">Auto</option>';
    
    // Add quality levels
    levels.forEach((level, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${level.height}p (${(level.bitrate / 1000000).toFixed(1)} Mbps)`;
        qualitySelector.appendChild(option);
    });
    
    // Add change event listener
    qualitySelector.addEventListener('change', function() {
        const selectedLevel = parseInt(this.value);
        
        if (selectedLevel === -1) {
            // Enable auto quality
            hls.currentLevel = -1;
            currentQuality.textContent = 'Auto';
            addEventLog('Quality switched to Auto', 'quality-change');
            console.log('Auto quality selection enabled');
        } else {
            // Set manual quality
            hls.currentLevel = selectedLevel;
            const level = hls.levels[selectedLevel];
            currentQuality.textContent = `Level ${selectedLevel}`;
            addEventLog(`Manually selected: ${level.height}p @ ${(level.bitrate / 1000000).toFixed(1)} Mbps`, 'quality-change');
            console.log(`Manual quality set to level ${selectedLevel}:`, level);
        }
    });
}

/**
 * Get current playback statistics
 * @returns {Object} Playback stats
 */
window.getPlaybackStats = function() {
    if (!hls) return null;
    
    return {
        currentLevel: hls.currentLevel,
        autoLevelEnabled: hls.autoLevelEnabled,
        levels: hls.levels,
        loadLevel: hls.loadLevel,
        nextLevel: hls.nextLevel,
        bufferLength: videoElement.buffered.length > 0 
            ? videoElement.buffered.end(0) - videoElement.currentTime 
            : 0
    };
};
