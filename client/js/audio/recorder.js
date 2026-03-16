/**
 * AudioRecorder manages the capture and processing of audio input from the user's microphone.
 * It uses the Web Audio API and AudioWorklet to process audio in real-time.
 */
export class AudioRecorder {
    /**
     * @param {AudioContext} audioContext - The shared AudioContext
     */
    constructor(audioContext) {
        this.audioContext = audioContext;
        this.sampleRate = 16000;         
        this.stream = null;              
        this.source = null;              
        this.processor = null;           
        this.onAudioData = null;         
        this.isRecording = false;        
        this.isSuspended = false;
        this._chunkCount = 0;
    }

    /**
     * Initializes and starts audio capture pipeline
     * @param {Function} onAudioData - Callback receiving raw Int16Array chunks
     */
    async start(onAudioData) {
        if (this.isRecording) return;
        
        this.onAudioData = onAudioData;
        console.info('🎙️ Starting AudioRecorder (16kHz)...');
        
        try {
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
                console.info('🧠 AudioContext resumed');
            }

            // Explicitly request 16000 for Gemini
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            
            console.info('🎙️ Microphone access granted', this.stream.getAudioTracks()[0].getSettings());

            this.source = this.audioContext.createMediaStreamSource(this.stream);

            // Load worklet
            try {
                // Use a cache-busting timestamp to ensure the latest worklet is loaded
                await this.audioContext.audioWorklet.addModule('js/audio/worklets/audio-processor.js?t=' + Date.now());
                console.info('🎙️ AudioWorklet module loaded');
            } catch (e) {
                console.debug('AudioWorklet module already added or failed to add:', e.message);
            }

            this.processor = new AudioWorkletNode(this.audioContext, 'audio-recorder-worklet');
            
            this.processor.port.onmessage = (event) => {
                if (!this.isRecording || this.isSuspended) return;
                
                if (event.data.event === 'chunk' && this.onAudioData) {
                    this._chunkCount++;
                    if (this._chunkCount % 20 === 0) {
                        console.debug(`🎙️ Received chunk #${this._chunkCount} from Worklet`);
                    }
                    // Pass the raw ArrayBuffer to the callback
                    this.onAudioData(event.data.data.int16arrayBuffer);
                }
                
                if (event.data.event === 'error') {
                    console.error('🎙️ Worklet error:', event.data.error);
                }
            };

            this.source.connect(this.processor);
            
            // Create a silent gain node to keep the graph active
            const silentGain = this.audioContext.createGain();
            silentGain.gain.value = 0;
            this.processor.connect(silentGain);
            silentGain.connect(this.audioContext.destination);
            
            this.isRecording = true;
            this.isSuspended = false;
            console.info('🎙️ Audio recording active and streaming');
        } catch (error) {
            console.error('🎙️ AudioRecorder start error:', error);
            throw new Error('Failed to start audio recording: ' + error.message);
        }
    }

    stop() {
        if (!this.isRecording) return;

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }

        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }

        this.isRecording = false;
        console.info('🎙️ Audio recording stopped');
    }

    async toggleMic() {
        if (!this.isRecording) {
            await this.start(this.onAudioData);
            return;
        }
        this.isSuspended = !this.isSuspended;
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.enabled = !this.isSuspended);
        }
        console.info(`🎙️ Microphone ${this.isSuspended ? 'suspended' : 'resumed'}`);
    }
}
