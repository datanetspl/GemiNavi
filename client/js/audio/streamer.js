/**
 * AudioStreamer manages real-time audio playback.
 * It takes 24kHz PCM16 data from Gemini and plays it in a 16kHz AudioContext.
 */
export class AudioStreamer {
    constructor(context) {
        this.context = context;
        this.audioQueue = [];
        this.isPlaying = false;
        this.sampleRate = 24000; // Gemini's output rate
        this.scheduledTime = 0;
        this.gainNode = this.context.createGain();
        this.isInitialized = false;
        this.gainNode.connect(this.context.destination);
        this._chunkCount = 0;
    }

    async initialize() {
        if (this.context.state === 'suspended') {
            await this.context.resume();
        }
        this.isInitialized = true;
        console.info('AudioStreamer: Initialized for 24kHz relay');
    }

    /**
     * @param {Uint8Array|ArrayBuffer} chunk - Raw PCM16 bytes from backend
     */
    streamAudio(chunk) {
        if (!this.isInitialized || !chunk) return;

        this._chunkCount++;
        if (this._chunkCount % 50 === 0) {
            console.debug(`🔊 AudioStreamer: Processing chunk #${this._chunkCount} (${chunk.byteLength || chunk.size} bytes)`);
        }

        try {
            // Ensure we have an ArrayBuffer
            const buffer = chunk instanceof ArrayBuffer ? chunk : chunk.buffer;
            const byteOffset = chunk.byteOffset || 0;
            const byteLength = chunk.byteLength || chunk.size;

            // 1. Convert PCM16 (2 bytes per sample) to Float32
            const dataView = new DataView(buffer, byteOffset, byteLength);
            const numSamples = byteLength / 2;
            const float32Array = new Float32Array(numSamples);

            for (let i = 0; i < numSamples; i++) {
                const int16 = dataView.getInt16(i * 2, true);
                float32Array[i] = int16 / 32768.0;
            }

            // 2. Create an AudioBuffer at Gemini's native rate (24000)
            const audioBuffer = this.context.createBuffer(1, numSamples, this.sampleRate);
            audioBuffer.getChannelData(0).set(float32Array);

            // 3. Schedule for gapless playback
            const source = this.context.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.gainNode);

            const startTime = Math.max(this.scheduledTime, this.context.currentTime + 0.05);
            source.start(startTime);
            
            this.scheduledTime = startTime + audioBuffer.duration;
            this.isPlaying = true;

        } catch (error) {
            console.error('AudioStreamer Error:', error);
        }
    }

    stop() {
        this.scheduledTime = 0;
        this.isPlaying = false;
        console.info('AudioStreamer: Playback stopped');
    }
}
