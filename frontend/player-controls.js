/**
 * Player Controls and Keyboard Shortcuts
 * Additional player functionality for speed controls, PiP, and keyboard shortcuts
 */

/**
 * Setup player control buttons
 */
function setupPlayerControls() {
    const speedBtn = document.getElementById('speedBtn');
    const pipBtn = document.getElementById('pipBtn');
    const videoElement = document.getElementById('videoPlayer');
    const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    let currentSpeedIndex = 2; // Default to 1x

    // Speed control button
    if (speedBtn) {
        speedBtn.addEventListener('click', () => {
            currentSpeedIndex = (currentSpeedIndex + 1) % PLAYBACK_SPEEDS.length;
            const speed = PLAYBACK_SPEEDS[currentSpeedIndex];
            videoElement.playbackRate = speed;
            speedBtn.textContent = `${speed}x`;
            addEventLog(`Playback speed: ${speed}x`, 'info');
        });
    }

    // Picture-in-Picture button
    if (pipBtn) {
        // Check PiP support
        if (!document.pictureInPictureEnabled) {
            pipBtn.style.display = 'none';
            return;
        }

        pipBtn.addEventListener('click', async () => {
            try {
                if (document.pictureInPictureElement) {
                    await document.exitPictureInPicture();
                    pipBtn.textContent = 'PiP';
                    addEventLog('Exited Picture-in-Picture', 'info');
                } else {
                    await videoElement.requestPictureInPicture();
                    pipBtn.textContent = 'Exit PiP';
                    addEventLog('Entered Picture-in-Picture', 'info');
                }
            } catch (error) {
                console.error('PiP error:', error);
                addEventLog('PiP not available', 'error');
            }
        });

        // Update button when PiP state changes
        videoElement.addEventListener('enterpictureinpicture', () => {
            pipBtn.textContent = 'Exit PiP';
        });

        videoElement.addEventListener('leavepictureinpicture', () => {
            pipBtn.textContent = 'PiP';
        });
    }
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    const videoElement = document.getElementById('videoPlayer');
    const speedBtn = document.getElementById('speedBtn');
    const pipBtn = document.getElementById('pipBtn');

    document.addEventListener('keydown', (e) => {
        // Ignore if typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }

        if (!videoElement) return;

        switch(e.key.toLowerCase()) {
            case ' ':
            case 'k':
                // Play/Pause
                e.preventDefault();
                if (videoElement.paused) {
                    videoElement.play();
                } else {
                    videoElement.pause();
                }
                break;

            case 'arrowleft':
                // Seek backward 5 seconds
                e.preventDefault();
                videoElement.currentTime = Math.max(0, videoElement.currentTime - 5);
                addEventLog('Seek -5s', 'info');
                break;

            case 'arrowright':
                // Seek forward 5 seconds
                e.preventDefault();
                videoElement.currentTime = Math.min(videoElement.duration, videoElement.currentTime + 5);
                addEventLog('Seek +5s', 'info');
                break;

            case 'j':
                // Seek backward 10 seconds
                e.preventDefault();
                videoElement.currentTime = Math.max(0, videoElement.currentTime - 10);
                addEventLog('Seek -10s', 'info');
                break;

            case 'l':
                // Seek forward 10 seconds
                e.preventDefault();
                videoElement.currentTime = Math.min(videoElement.duration, videoElement.currentTime + 10);
                addEventLog('Seek +10s', 'info');
                break;

            case 'm':
                // Toggle mute
                e.preventDefault();
                videoElement.muted = !videoElement.muted;
                addEventLog(videoElement.muted ? 'Muted' : 'Unmuted', 'info');
                break;

            case 'f':
                // Toggle fullscreen
                e.preventDefault();
                if (!document.fullscreenElement) {
                    videoElement.requestFullscreen().catch(err => {
                        console.error('Fullscreen error:', err);
                    });
                } else {
                    document.exitFullscreen();
                }
                break;

            case 'p':
                // Toggle Picture-in-Picture
                e.preventDefault();
                if (pipBtn) pipBtn.click();
                break;

            case 's':
                // Cycle playback speed
                e.preventDefault();
                if (speedBtn) speedBtn.click();
                break;

            case 'arrowup':
                // Volume up
                e.preventDefault();
                videoElement.volume = Math.min(1, videoElement.volume + 0.1);
                addEventLog(`Volume: ${Math.round(videoElement.volume * 100)}%`, 'info');
                break;

            case 'arrowdown':
                // Volume down
                e.preventDefault();
                videoElement.volume = Math.max(0, videoElement.volume - 0.1);
                addEventLog(`Volume: ${Math.round(videoElement.volume * 100)}%`, 'info');
                break;

            case '0':
            case 'home':
                // Jump to beginning
                e.preventDefault();
                videoElement.currentTime = 0;
                addEventLog('Jump to start', 'info');
                break;

            case 'end':
                // Jump to end
                e.preventDefault();
                videoElement.currentTime = videoElement.duration;
                addEventLog('Jump to end', 'info');
                break;
        }
    });

    // Add keyboard shortcut info to event log on initialization
    addEventLog('⌨️ Shortcuts: Space=Play/Pause, ←→=Seek ±5s, J/L=Seek ±10s, F=Fullscreen, M=Mute, S=Speed, P=PiP', 'info');
}
