export const getWebsocketUrl = () => {
    // During development, we use localhost. In production, this would be the Cloud Run/GKE URL.
    return localStorage.getItem('backendUrl') || 'ws://localhost:8000/ws';
};

// Audio Configurations
export const MODEL_SAMPLE_RATE = parseInt(localStorage.getItem('sampleRate')) || 24000;