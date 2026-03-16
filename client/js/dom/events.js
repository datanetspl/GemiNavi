import elements from './elements.js';
import settingsManager from '../settings/settings-manager.js';

/**
 * Updates UI to show disconnect button and hide connect button
 */
const showDisconnectButton = () => {
    elements.connectBtn.style.display = 'none';
    elements.disconnectBtn.style.display = 'block';
};

/**
 * Updates UI to show connect button and hide disconnect button
 */
const showConnectButton = () => {
    elements.disconnectBtn.style.display = 'none';
    elements.connectBtn.style.display = 'block';
};

let isCameraActive = false;

/**
 * Ensures the agent is connected and initialized
 * @param {GeminiAgent} agent - The main application agent instance
 * @returns {Promise<void>}
 */
const ensureAgentReady = async (agent) => {
    if (!agent.connected) {
        elements.micBtn.textContent = '⏳';
        await agent.connect();
        showDisconnectButton();
    }
    if (!agent.initialized) {
        await agent.initialize();
    }
    elements.micBtn.textContent = '🎤';
};

/**
 * Sets up event listeners for the application's UI elements
 * @param {GeminiAgent} agent - The main application agent instance
 */
export function setupEventListeners(agent) {
    // Disconnect handler
    elements.disconnectBtn.addEventListener('click', async () => {
        try {
            await agent.disconnect();
            showConnectButton();
            [elements.cameraBtn, elements.screenBtn, elements.micBtn].forEach(btn => btn.classList.remove('active'));
            isCameraActive = false;
        } catch (error) {
            console.error('Error disconnecting:', error);
        }
    });

    // Connect handler
    elements.connectBtn.addEventListener('click', async () => {
        try {
            await ensureAgentReady(agent);
        } catch (error) {
            console.error('Error connecting:', error);
        }
    });

    // Microphone toggle handler
    elements.micBtn.addEventListener('click', async () => {
        try {
            await ensureAgentReady(agent);
            await agent.toggleMic();
            elements.micBtn.classList.toggle('active');
        } catch (error) {
            console.error('Error toggling microphone:', error);
            elements.micBtn.classList.remove('active');
        }
    });

    // Camera toggle handler
    elements.cameraBtn.addEventListener('click', async () => {
        try {
            await ensureAgentReady(agent);
            
            if (!isCameraActive) {
                await agent.startCameraCapture();
                elements.cameraBtn.classList.add('active');
            } else {
                await agent.stopCameraCapture();
                elements.cameraBtn.classList.remove('active');
            }
            isCameraActive = !isCameraActive;
        } catch (error) {
            console.error('Error toggling camera:', error);
            elements.cameraBtn.classList.remove('active');
            isCameraActive = false;
        }
    });

    // Screen sharing handler
    let isScreenShareActive = false;
    
    // Listen for screen share stopped events (from native browser controls)
    agent.on('screenshare_stopped', () => {
        elements.screenBtn.classList.remove('active');
        isScreenShareActive = false;
        console.info('Screen share stopped');
    });

    elements.screenBtn.addEventListener('click', async () => {
        try {
            await ensureAgentReady(agent);
            
            if (!isScreenShareActive) {
                await agent.startScreenShare();
                elements.screenBtn.classList.add('active');
            } else {
                await agent.stopScreenShare();
                elements.screenBtn.classList.remove('active');
            }
            isScreenShareActive = !isScreenShareActive;
        } catch (error) {
            console.error('Error toggling screen share:', error);
            elements.screenBtn.classList.remove('active');
            isScreenShareActive = false;
        }
    });

    // Message sending handlers
    const sendMessage = async () => {
        try {
            await ensureAgentReady(agent);
            const text = elements.messageInput.value.trim();
            await agent.sendText(text);
            elements.messageInput.value = '';
        } catch (error) {
            console.error('Error sending message:', error);
        }
    };

    elements.sendBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendMessage();
        }
    });

    // Settings button click
    elements.settingsBtn.addEventListener('click', () => settingsManager.show());

    // Browser navigation handlers
    elements.browserBackBtn.addEventListener('click', () => window.api.browserControl.goBack());
    elements.browserForwardBtn.addEventListener('click', () => window.api.browserControl.goForward());
    elements.browserReloadBtn.addEventListener('click', () => window.api.browserControl.reload());
    
    // Browser Mode & External Connection
    elements.browserModeSelect.addEventListener('change', async () => {
        const mode = elements.browserModeSelect.value;
        await window.api.browserControl.switchMode(mode);
        console.info(`Switched to ${mode} browser mode`);
    });

    elements.browserConnectBtn.addEventListener('click', async () => {
        const port = parseInt(elements.browserPortInput.value) || 9222;
        try {
            elements.browserConnectBtn.textContent = '⏳';
            const result = await window.api.browserControl.connectExternal(port);
            if (result.success) {
                elements.browserConnectBtn.textContent = '✅';
                elements.browserModeSelect.value = 'external';
                console.info('Connected to external browser successfully');
            } else {
                elements.browserConnectBtn.textContent = '❌';
                console.error('Failed to connect to external browser:', result.error);
                alert('Connection failed. Make sure Chrome/Edge is running with --remote-debugging-port=' + port);
            }
        } catch (error) {
            elements.browserConnectBtn.textContent = '❌';
            console.error('Error connecting to external browser:', error);
        }
    });

    const handleBrowserLaunch = async (type) => {
        const port = parseInt(elements.browserPortInput.value) || 9222;
        const btn = type === 'chrome' ? elements.launchChromeBtn : elements.launchEdgeBtn;
        const originalText = btn.textContent;
        
        try {
            btn.textContent = '⏳ Launching...';
            const result = await window.api.browserControl.launchExternal(type, port);
            if (result.success) {
                btn.textContent = '✅ Started';
                elements.browserModeSelect.value = 'external';
                elements.browserConnectBtn.textContent = '✅';
                console.info(`${type} launched and connected successfully`);
                setTimeout(() => { btn.textContent = originalText; }, 3000);
            } else {
                btn.textContent = '❌ Failed';
                alert(`Failed to launch ${type}: ${result.error}`);
                setTimeout(() => { btn.textContent = originalText; }, 3000);
            }
        } catch (error) {
            btn.textContent = '❌ Error';
            console.error(`Error launching ${type}:`, error);
            alert(`Error launching ${type}. Make sure it is installed in the default location.`);
            setTimeout(() => { btn.textContent = originalText; }, 3000);
        }
    };

    elements.launchChromeBtn.addEventListener('click', () => handleBrowserLaunch('chrome'));
    elements.launchEdgeBtn.addEventListener('click', () => handleBrowserLaunch('edge'));

    const handleNavigation = () => {
        const url = elements.browserUrlInput.value.trim();
        if (url) {
            window.api.browserControl.navigate(url);
        }
    };

    elements.browserGoBtn.addEventListener('click', handleNavigation);
    elements.browserUrlInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleNavigation();
        }
    });

    // Sync URL input with browser window
    window.api.browserControl.onUrlChange((url) => {
        elements.browserUrlInput.value = url;
    });
}

// Initialize settings
settingsManager;
