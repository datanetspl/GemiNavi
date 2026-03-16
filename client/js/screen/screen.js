/**
 * Manages screen sharing capture and image processing
 */
export class ScreenManager {
    /**
     * @param {Object} config
     * @param {number} config.width - Target width for resizing captured images
     * @param {number} config.quality - JPEG quality (0-1)
     * @param {Function} [config.onStop] - Callback when screen sharing stops
     */
    constructor(config) {
        this.config = {
            width: config.width || 1280,
            quality: config.quality || 0.8,
            onStop: config.onStop
        };
        
        this.stream = null;
        this.videoElement = null;
        this.canvas = null;
        this.ctx = null;
        this.isInitialized = false;
        this.aspectRatio = null;
        this.previewContainer = null;
    }

    /**
     * Show the screen preview
     */
    showPreview() {
        if (this.previewContainer) {
            this.previewContainer.style.display = 'block';
        }
    }

    /**
     * Hide the screen preview
     */
    hidePreview() {
        if (this.previewContainer) {
            this.previewContainer.style.display = 'none';
        }
    }

    /**
     * Initialize screen capture stream and canvas
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            let sourceId = null;

            // Attempt to get the dedicated browser window ID first
            try {
                sourceId = await window.api.browserControl.getBrowserSourceId();
            } catch (e) {
                console.warn('Could not get dedicated browser source ID:', e);
            }

            // Fallback to searching all sources if no dedicated ID
            if (!sourceId) {
                const sources = await window.api.getScreenSources();
                // Find browser window by title or just use first screen
                const browserSource = sources.find(s => 
                    s.name.toLowerCase().includes('google') || 
                    s.name.toLowerCase().includes('chrome') ||
                    s.name.toLowerCase().includes('gemini')
                );
                sourceId = browserSource ? browserSource.id : (sources[0] ? sources[0].id : null);
            }
            
            if (!sourceId) {
                throw new Error('No screen sources available');
            }

            // Request screen sharing using the source ID
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: sourceId,
                        maxWidth: 1920,
                        maxHeight: 1080
                    }
                }
            });

            // Create and setup video element
            this.videoElement = document.createElement('video');
            this.videoElement.srcObject = this.stream;
            this.videoElement.playsInline = true;
            this.videoElement.muted = true; // Ensure it's muted for autoplay

            // Add video to preview container
            const previewContainer = document.getElementById('screenPreview');
            if (previewContainer) {
                previewContainer.innerHTML = ''; // Clear any existing content
                previewContainer.appendChild(this.videoElement);
                this.previewContainer = previewContainer;
                this.showPreview(); // Show preview when initialized
            }

            // Wait for video to be ready
            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    resolve();
                };
            });

            await this.videoElement.play();

            // Get the actual video dimensions with fallback
            const videoWidth = this.videoElement.videoWidth || 1280;
            const videoHeight = this.videoElement.videoHeight || 720;
            this.aspectRatio = videoHeight / videoWidth;

            // Calculate canvas size maintaining aspect ratio
            const targetWidth = parseInt(this.config.width) || 1280;
            const canvasWidth = targetWidth;
            const canvasHeight = Math.round(targetWidth * this.aspectRatio);

            // Create canvas for image processing
            this.canvas = document.createElement('canvas');
            this.canvas.width = canvasWidth;
            this.canvas.height = canvasHeight;
            this.ctx = this.canvas.getContext('2d');

            // Listen for the end of screen sharing
            const videoTracks = this.stream.getVideoTracks();
            if (videoTracks.length > 0) {
                videoTracks[0].addEventListener('ended', () => {
                    this.dispose();
                    // Notify parent component that sharing has stopped
                    if (this.config.onStop) {
                        this.config.onStop();
                    }
                });
            }

            this.isInitialized = true;
        } catch (error) {
            console.error('ScreenManager initialization error:', error);
            throw new Error(`Failed to initialize screen capture: ${error.message}`);
        }
    }

    /**
     * Get current canvas dimensions
     * @returns {{width: number, height: number}}
     */
    getDimensions() {
        if (!this.isInitialized) {
            throw new Error('Screen capture not initialized. Call initialize() first.');
        }
        return {
            width: this.canvas.width,
            height: this.canvas.height
        };
    }

    /**
     * Capture and process a screenshot
     * @returns {Promise<ArrayBuffer>} Binary JPEG image data
     */
    async capture() {
        if (!this.isInitialized) {
            throw new Error('Screen capture not initialized. Call initialize() first.');
        }

        // Draw current video frame to canvas, maintaining aspect ratio
        this.ctx.drawImage(
            this.videoElement,
            0, 0,
            this.canvas.width,
            this.canvas.height
        );

        // Convert to ArrayBuffer
        return new Promise((resolve) => {
            this.canvas.toBlob((blob) => {
                blob.arrayBuffer().then(resolve);
            }, 'image/jpeg', this.config.quality);
        });
    }

    /**
     * Stop screen capture and cleanup resources
     */
    dispose() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.videoElement) {
            this.videoElement.srcObject = null;
            this.videoElement = null;
        }

        if (this.previewContainer) {
            this.hidePreview();
            this.previewContainer.innerHTML = ''; // Clear the preview container
            this.previewContainer = null;
        }

        this.canvas = null;
        this.ctx = null;
        this.isInitialized = false;
        this.aspectRatio = null;
    }
}
