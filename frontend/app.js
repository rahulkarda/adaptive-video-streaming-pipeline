// Configuration
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api' 
  : 'https://your-backend.onrender.com/api'; // Update with your Render backend URL

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
const playerSection = document.getElementById('playerSection');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const uploadStatus = document.getElementById('uploadStatus');
const processingStatus = document.getElementById('processingStatus');
const processingText = document.getElementById('processingText');
const resetButton = document.getElementById('resetButton');

// State
let currentFile = null;
let progressInterval = null;

// Pipeline step tracking
const pipelineSteps = [
    { id: 'upload', element: null, label: 'Uploading video...' },
    { id: 'ffmpeg', element: null, label: 'FFmpeg transcoding...' },
    { id: 'multi-quality', element: null, label: 'Creating quality levels...' },
    { id: 'storage', element: null, label: 'Saving HLS files...' },
    { id: 'player', element: null, label: 'Preparing player...' }
];

/**
 * Initialize pipeline step elements
 */
function initPipelineSteps() {
    const steps = document.querySelectorAll('.pipeline-step');
    pipelineSteps.forEach((step, index) => {
        step.element = steps[index];
    });
}

/**
 * Update active pipeline step
 * @param {number} stepIndex - Index of current step
 */
function updatePipelineStep(stepIndex) {
    pipelineSteps.forEach((step, index) => {
        if (step.element) {
            step.element.classList.remove('active', 'completed');
            if (index < stepIndex) {
                step.element.classList.add('completed');
            } else if (index === stepIndex) {
                step.element.classList.add('active');
            }
        }
    });
    
    if (stepIndex >= 0 && stepIndex < pipelineSteps.length) {
        processingText.textContent = pipelineSteps[stepIndex].label;
    }
}

/**
 * Reset pipeline steps
 */
function resetPipelineSteps() {
    pipelineSteps.forEach(step => {
        if (step.element) {
            step.element.classList.remove('active', 'completed');
        }
    });
}

/**
 * Initialize upload functionality
 */
function initUpload() {
    // File input change handler
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileSelection(file);
        }
    });

    // Drag and drop handlers
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) {
            handleFileSelection(file);
        } else {
            showStatus('Please upload a valid video file', 'error');
        }
    });

    // Click to select file - only on upload area, not on label
    uploadArea.addEventListener('click', (e) => {
        // Don't trigger if clicking on the label (it has its own handler)
        if (e.target.tagName !== 'LABEL') {
            fileInput.click();
        }
    });

    // Reset button
    resetButton.addEventListener('click', resetUpload);
}

/**
 * Handle file selection
 * @param {File} file - Selected video file
 */
function handleFileSelection(file) {
    // Validate file type
    if (!file.type.startsWith('video/')) {
        showStatus('Please select a video file', 'error');
        return;
    }

    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
        showStatus('File size exceeds 100MB limit', 'error');
        return;
    }

    currentFile = file;
    uploadVideo(file);
}

/**
 * Upload video to backend
 * @param {File} file - Video file to upload
 */
async function uploadVideo(file) {
    const formData = new FormData();
    formData.append('video', file);

    // Show progress
    uploadProgress.style.display = 'block';
    uploadStatus.style.display = 'none';
    processingStatus.style.display = 'block';
    progressText.textContent = 'Uploading...';
    
    // Reset and start pipeline visualization
    resetPipelineSteps();
    updatePipelineStep(0); // Upload step
    
    try {
        const xhr = new XMLHttpRequest();

        // Progress handler
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressFill.style.width = percentComplete + '%';
                progressText.textContent = `Uploading: ${Math.round(percentComplete)}%`;
            }
        });

        // Load handler
        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                if (response.success) {
                    // Move to FFmpeg step
                    updatePipelineStep(1);
                    progressText.textContent = 'Transcoding with FFmpeg...';
                    
                    // Simulate processing steps
                    setTimeout(() => {
                        updatePipelineStep(2); // Multi-quality
                        processingText.textContent = 'Creating 360p, 480p, 720p...';
                    }, 1000);
                    
                    setTimeout(() => {
                        updatePipelineStep(3); // Storage
                        processingText.textContent = 'Saving HLS files...';
                    }, 2000);
                    
                    setTimeout(() => {
                        updatePipelineStep(4); // Player
                        processingText.textContent = 'Preparing player...';
                    }, 3000);
                    
                    setTimeout(() => {
                        handleUploadSuccess(response.data);
                    }, 4000);
                } else {
                    handleUploadError(response.error || 'Upload failed');
                }
            } else {
                const error = JSON.parse(xhr.responseText);
                handleUploadError(error.error || 'Upload failed');
            }
        });

        // Error handler
        xhr.addEventListener('error', () => {
            handleUploadError('Network error occurred');
        });

        // Send request
        xhr.open('POST', `${API_URL}/upload`);
        xhr.send(formData);

    } catch (error) {
        console.error('Upload error:', error);
        handleUploadError(error.message);
    }
}

/**
 * Handle successful upload
 * @param {Object} data - Upload response data
 */
function handleUploadSuccess(data) {
    console.log('Upload successful:', data);
    
    // Mark all steps as completed
    pipelineSteps.forEach((step, index) => {
        if (step.element) {
            step.element.classList.add('completed');
            step.element.classList.remove('active');
        }
    });
    
    progressText.textContent = 'Processing complete! Initializing player...';
    progressFill.style.width = '100%';
    processingText.textContent = 'Complete! Loading video...';
    
    showStatus('✅ Video uploaded successfully! Loading player...', 'success');

    // Wait a moment then switch to player
    setTimeout(() => {
        uploadSection.style.display = 'none';
        playerSection.style.display = 'block';
        processingStatus.style.display = 'none';
        
        // Initialize HLS player with the URL
        if (window.initPlayer) {
            window.initPlayer(data.hlsUrl, data.fileName);
        }
    }, 1500);
}

/**
 * Handle upload error
 * @param {string} errorMessage - Error message
 */
function handleUploadError(errorMessage) {
    console.error('Upload failed:', errorMessage);
    
    resetPipelineSteps();
    uploadProgress.style.display = 'none';
    processingStatus.style.display = 'none';
    showStatus(`❌ Upload failed: ${errorMessage}`, 'error');
    
    // Reset progress
    progressFill.style.width = '0%';
}

/**
 * Show status message
 * @param {string} message - Status message
 * @param {string} type - Status type (success/error)
 */
function showStatus(message, type) {
    uploadStatus.textContent = message;
    uploadStatus.className = `upload-status ${type}`;
    uploadStatus.style.display = 'block';

    // Auto-hide after 5 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            uploadStatus.style.display = 'none';
        }, 5000);
    }
}

/**
 * Reset upload section
 */
function resetUpload() {
    // Stop current player if exists
    if (window.stopPlayer) {
        window.stopPlayer();
    }

    // Reset UI
    playerSection.style.display = 'none';
    uploadSection.style.display = 'block';
    uploadProgress.style.display = 'none';
    uploadStatus.style.display = 'none';
    processingStatus.style.display = 'none';
    progressFill.style.width = '0%';
    fileInput.value = '';
    currentFile = null;
    resetPipelineSteps();
}

/**
 * Format file size
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initPipelineSteps();
    initUpload();
    
    resetButton.addEventListener('click', resetUpload);
});
