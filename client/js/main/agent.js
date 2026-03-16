/**
 * Core application class that orchestrates the interaction between various components
 * of the Gemini Live Agent. Manages local audio/video capture and tool execution,
 * while relaying intelligence to a remote Gemini Backend.
 */
import { GeminiWebsocketClient } from '../ws/client.js';

import { AudioRecorder } from '../audio/recorder.js';
import { AudioStreamer } from '../audio/streamer.js';
import { AudioVisualizer } from '../audio/visualizer.js';

import { CameraManager } from '../camera/camera.js';
import { ScreenManager } from '../screen/screen.js';

export class GeminiAgent {
    constructor({
        name = 'GeminiAgent',
        url,
        modelSampleRate = 24000,
        toolManager = null
    } = {}) {
        if (!url) throw new Error('WebSocket URL is required');

        this.initialized = false;
        this.connected = false;
        this._eventListeners = new Map();

        // For audio components
        this.audioContext = null;
        this.audioRecorder = null;
        this.audioStreamer = null;
        this.modelSampleRate = modelSampleRate;
        this._receivedAudioChunks = 0;

        // Initialize screen & camera settings
        this.fps = parseInt(localStorage.getItem('fps')) || 5;
        this.captureInterval = 1000 / this.fps;
        this.resizeWidth = parseInt(localStorage.getItem('resizeWidth')) || 640;
        this.quality = parseFloat(localStorage.getItem('quality')) || 0.4;
        
        // Initialize camera
        this.cameraManager = new CameraManager({
            width: this.resizeWidth,
            quality: this.quality,
            facingMode: localStorage.getItem('facingMode') || 'environment'
        });
        this.cameraInterval = null;

        // Initialize screen sharing
        this.screenManager = new ScreenManager({
            width: this.resizeWidth,
            quality: this.quality,
            onStop: () => {
                if (this.screenInterval) {
                    clearInterval(this.screenInterval);
                    this.screenInterval = null;
                }
                this.emit('screenshare_stopped');
            }
        });
        this.screenInterval = null;
        
        this.toolManager = toolManager;
        this.name = name;
        this.url = url;
        this.client = null;
    }

    setupEventListeners() {
        if (!this.client) return;
        
        // Handle incoming binary audio data from the model (via backend)
        this.client.on('audio', async (data) => {
            this._receivedAudioChunks++;
            // LOG EVERY SINGLE CHUNK FOR DEBUGGING
            console.debug(`🔊 Received chunk #${this._receivedAudioChunks} from relay (${data.byteLength} bytes)`);
            
            try {
                if (this.audioStreamer && this.audioStreamer.isInitialized) {
                    this.audioStreamer.streamAudio(new Uint8Array(data));
                }
            } catch (error) {
                console.error('Audio processing error:', error);
            }
        });

        this.client.on('text', (text) => {
            this.emit('text', text);
        });

        this.client.on('transcription', (text) => {
            this.emit('transcription', text);
        });

        // Handle model interruptions
        this.client.on('interrupted', () => {
            if (this.audioStreamer) {
                this.audioStreamer.stop();
                this.audioStreamer.initialize();
            }
            this.emit('interrupted');
        });

        this.client.on('turn_complete', () => {
            this.emit('turn_complete');
        });

        // Handle tool call requests from the remote backend
        this.client.on('tool_call', async (toolCall) => {
            console.info(`Remote requested tool: ${toolCall.name}`, toolCall.args);
            const response = await this.toolManager.handleToolCall({
                name: toolCall.name,
                args: toolCall.args,
                id: toolCall.id
            });
            await this.client.sendToolResponse(response);
        });

        this.client.on('close', (event) => {
            console.warn(`Agent: WebSocket connection closed.`);
            this.connected = false;
            this.emit('disconnected', event);
        });

        this.client.on('error', (error) => {
            console.error('Agent: WebSocket error', error);
            this.emit('error', error);
        });
    }

    /**
     * Connects to the Remote Backend.
     */
    async connect() {
        if (this.connected && this.client) return;
        
        console.info('Agent: Connecting to remote backend...');
        this.client = new GeminiWebsocketClient(this.name, this.url);
        await this.client.connect();
        this.setupEventListeners();
        this.connected = true;
        
        if (!this.initialized) {
            await this.initialize();
        }
    }

    async sendText(text) {
        if (!this.connected) return;
        await this.client.sendText(text);
        this.emit('text_sent', text);
    }

    async startCameraCapture() {
        if (!this.connected) throw new Error('Must be connected to start camera capture');
        try {
            await this.cameraManager.initialize();
            this.cameraInterval = setInterval(async () => {
                if (this.connected) {
                    const imageBuffer = await this.cameraManager.capture();
                    this.client.sendImage(imageBuffer);
                }
            }, this.captureInterval);
        } catch (error) {
            await this.disconnect();
            throw new Error('Failed to start camera capture: ' + error);
        }
    }

    async stopCameraCapture() {
        if (this.cameraInterval) {
            clearInterval(this.cameraInterval);
            this.cameraInterval = null;
        }
        if (this.cameraManager) this.cameraManager.dispose();
    }

    async startScreenShare() {
        if (!this.connected) throw new Error('Websocket must be connected to start screen sharing');
        try {
            await this.screenManager.initialize();
            this.screenInterval = setInterval(async () => {
                if (this.connected) {
                    const imageBuffer = await this.screenManager.capture();
                    this.client.sendImage(imageBuffer);
                }
            }, this.captureInterval);
        } catch (error) {
            await this.stopScreenShare();
            throw new Error('Failed to start screen sharing: ' + error);
        }
    }

    async stopScreenShare() {
        if (this.screenInterval) {
            clearInterval(this.screenInterval);
            this.screenInterval = null;
        }
        if (this.screenManager) this.screenManager.dispose();
    }

    async disconnect() {
        try {
            await this.stopCameraCapture();
            await this.stopScreenShare();

            if (this.audioRecorder) {
                this.audioRecorder.stop();
                this.audioRecorder = null;
            }

            if (this.visualizer) {
                this.visualizer.cleanup();
                this.visualizer = null;
            }

            if (this.audioStreamer) {
                this.audioStreamer.stop();
                this.audioStreamer = null;
            }

            if (this.audioContext) {
                await this.audioContext.close();
                this.audioContext = null;
            }

            if (this.client) {
                this.client.disconnect();
                this.client = null;
            }
            this.initialized = false;
            this.connected = false;
        } catch (error) {
            console.error('Disconnect error:', error);
        }
    }

    async initialize() {
        try {            
            // Context rate for mic capture (16kHz)
            const contextSampleRate = 16000;
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: contextSampleRate
            });
            
            this.audioStreamer = new AudioStreamer(this.audioContext);
            this.audioStreamer.sampleRate = 24000; // Native Gemini output rate
            await this.audioStreamer.initialize();
            
            this.visualizer = new AudioVisualizer(this.audioContext, 'visualizer');
            this.visualizer.start();
            this.audioStreamer.gainNode.connect(this.visualizer.analyser);
            
            this.audioRecorder = new AudioRecorder(this.audioContext);
            this.initialized = true;
            
            // Initial greeting
            this.client.sendText('User joined session.'); 
        } catch (error) {
            console.error('Initialization error:', error);
            throw new Error('Error during the initialization: ' + error.message);
        }
    }

    async startRecording() {
        await this.audioRecorder.start(async (audioData) => {
            if (this.connected) {
                this.client.sendAudio(audioData);
            }
        });

        if (this.audioRecorder.source) {
            this.audioRecorder.source.connect(this.visualizer.analyser);
        }
    }

    async toggleMic() {
        if (!this.audioRecorder || !this.audioRecorder.isRecording) {
            await this.startRecording();
            return;
        }
        await this.audioRecorder.toggleMic();
    }           

    on(eventName, callback) {
        if (!this._eventListeners.has(eventName)) {
            this._eventListeners.set(eventName, []);
        }
        this._eventListeners.get(eventName).push(callback);
    }

    emit(eventName, data) {
        if (!this._eventListeners.has(eventName)) return;
        for (const callback of this._eventListeners.get(eventName)) {
            callback(data);
        }
    }
}
