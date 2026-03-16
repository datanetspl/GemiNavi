// DOM elements object
const elements = {
    // Button elements
    disconnectBtn: document.getElementById('disconnectBtn'),
    connectBtn: document.getElementById('connectBtn'),
    micBtn: document.getElementById('micBtn'),
    cameraBtn: document.getElementById('cameraBtn'),
    screenBtn: document.getElementById('screenBtn'),
    settingsBtn: document.getElementById('settingsBtn'),

    // Browser controls
    browserBackBtn: document.getElementById('browserBackBtn'),
    browserForwardBtn: document.getElementById('browserForwardBtn'),
    browserReloadBtn: document.getElementById('browserReloadBtn'),
    browserUrlInput: document.getElementById('browserUrlInput'),
    browserGoBtn: document.getElementById('browserGoBtn'),
    browserModeSelect: document.getElementById('browserModeSelect'),
    browserPortInput: document.getElementById('browserPortInput'),
    browserConnectBtn: document.getElementById('browserConnectBtn'),
    launchChromeBtn: document.getElementById('launchChromeBtn'),
    launchEdgeBtn: document.getElementById('launchEdgeBtn'),

    // Preview elements
    cameraPreview: document.getElementById('cameraPreview'),
    screenPreview: document.getElementById('screenPreview'),

    // Text input elements
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),

    // Visualizer canvas
    visualizerCanvas: document.getElementById('visualizer')
};

// Log element presence for debugging
Object.entries(elements).forEach(([name, el]) => {
    if (!el) console.warn(`⚠️ DOM element not found: ${name}`);
});

export default elements;
