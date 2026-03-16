/**
 * Client for interacting with the Remote Gemini Backend via WebSockets.
 * This class handles the bidirectional relay of media and control messages.
 */
export class GeminiWebsocketClient {
    constructor(name, url) {
        this._eventListeners = new Map();
        this.name = name || 'WebSocketClient';
        this.url = url;
        this.ws = null;
        this.isConnecting = false;
        this.connectionPromise = null;
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

    async connect() {
        if (this.ws?.readyState === WebSocket.OPEN) return this.connectionPromise;
        if (this.isConnecting) return this.connectionPromise;

        console.info(`🔗 Connecting to Remote Backend at ${this.url}...`);
        this.isConnecting = true;
        this.connectionPromise = new Promise((resolve, reject) => {
            try {
                const ws = new WebSocket(this.url);
                ws.binaryType = 'arraybuffer'; 

                ws.addEventListener('open', () => {
                    console.info('🔗 Connected to backend.');
                    this.ws = ws;
                    this.isConnecting = false;
                    resolve();
                });

                ws.addEventListener('error', (error) => {
                    console.error('❌ WebSocket error:', error);
                    this.disconnect();
                    this.emit('error', error);
                    reject(error);
                });

                ws.addEventListener('close', (event) => {
                    console.info('🔗 Connection closed.');
                    this.ws = null;
                    this.isConnecting = false;
                    this.emit('close', event);
                });

                ws.addEventListener('message', async (event) => {
                    // LOG EVERYTHING
                    if (event.data instanceof ArrayBuffer) {
                        console.debug(`📥 Received Binary (ArrayBuffer): ${event.data.byteLength} bytes`);
                        this.emit('audio', event.data);
                    } else if (event.data instanceof Blob) {
                        console.debug(`📥 Received Binary (Blob): ${event.data.size} bytes`);
                        const buffer = await event.data.arrayBuffer();
                        this.emit('audio', buffer);
                    } else if (typeof event.data === 'string') {
                        console.debug(`📥 Received String: ${event.data.substring(0, 100)}`);
                        try {
                            const msg = JSON.parse(event.data);
                            this.handleJSONMessage(msg);
                        } catch (e) {
                            console.error('❌ Error parsing JSON message:', e);
                        }
                    } else {
                        console.warn('📥 Received Unknown Data Type:', typeof event.data);
                    }
                });
            } catch (err) {
                this.isConnecting = false;
                reject(err);
            }
        });

        return this.connectionPromise;
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.isConnecting = false;
            this.connectionPromise = null;
        }
    }

    handleJSONMessage(msg) {
        switch (msg.type) {
            case 'text':
                this.emit('text', msg.text);
                break;
            case 'transcription':
                this.emit('transcription', msg.text);
                break;
            case 'transcription_model':
                this.emit('transcription_model', msg.text);
                break;
            case 'tool_call':
                this.emit('tool_call', msg);
                break;
            case 'interrupted':
                this.emit('interrupted');
                break;
            case 'turn_complete':
                this.emit('turn_complete');
                break;
            default:
                this.emit('json', msg);
        }
    }

    async sendAudio(audioBuffer) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(audioBuffer);
        }
    }

    async sendImage(imageBuffer) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(imageBuffer);
        }
    }

    async sendText(text) {
        await this.sendJSON({ type: 'text', text: text });
    }

    async sendToolResponse(toolResponse) {
        const { output, id, error } = toolResponse;
        await this.sendJSON({
            type: 'tool_response',
            id: id,
            result: error ? { error } : output
        });
    }

    async sendJSON(json) {        
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(json));
        }
    }
}
