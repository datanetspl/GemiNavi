/**
 * AudioProcessingWorklet handles real-time audio processing in a dedicated thread.
 * It converts incoming Float32 audio samples to Int16 format for efficient network transmission.
 */
class AudioProcessingWorklet extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = new Int16Array(2048);
        this.bufferWriteIndex = 0;
    }

    /**
     * Processes incoming audio data in chunks
     */
    process(inputs, outputs) {
        const input = inputs[0];
        const output = outputs[0];

        if (input.length > 0 && input[0].length > 0) {
            const inputChannel = input[0];
            const outputChannel = output[0];

            // 1. Copy input to output so downstream nodes (like Visualizer) get the audio
            if (outputChannel) {
                outputChannel.set(inputChannel);
            }

            // 2. Process for transmission to Gemini
            this.processChunk(inputChannel);
        }
        return true;
    }

    sendAndClearBuffer() {
        this.port.postMessage({
            event: 'chunk',
            data: {
                int16arrayBuffer: this.buffer.slice(0, this.bufferWriteIndex).buffer,
            },
        });
        this.bufferWriteIndex = 0;
    }

    processChunk(float32Array) {
        try {
            for (let i = 0; i < float32Array.length; i++) {
                // Convert Float32 to Int16
                const int16Value = Math.max(-32768, Math.min(32767, Math.floor(float32Array[i] * 32768)));
                this.buffer[this.bufferWriteIndex++] = int16Value;

                if (this.bufferWriteIndex >= this.buffer.length) {
                    this.sendAndClearBuffer();
                }
            }
        } catch (error) {
            this.port.postMessage({
                event: 'error',
                error: { message: error.message }
            });
        }
    }
}

registerProcessor('audio-recorder-worklet', AudioProcessingWorklet);
