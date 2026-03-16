const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'api', {
        // Add desktop capturer method
        getScreenSources: async () => {
            try {
                return await ipcRenderer.invoke('GET_SOURCES');
            } catch (error) {
                throw new Error(`Failed to get screen sources: ${error.message}`);
            }
        },
        // Browser control methods
        browserControl: {
            navigate: (url) => ipcRenderer.invoke('BROWSER_NAVIGATE', url),
            executeScript: (script) => ipcRenderer.invoke('BROWSER_EXECUTE_SCRIPT', script),
            getBrowserSourceId: () => ipcRenderer.invoke('GET_BROWSER_SOURCE_ID'),
            onUrlChange: (callback) => ipcRenderer.on('BROWSER_URL_CHANGED', (event, url) => callback(url)),
            goBack: () => ipcRenderer.invoke('BROWSER_BACK'),
            goForward: () => ipcRenderer.invoke('BROWSER_FORWARD'),
            reload: () => ipcRenderer.invoke('BROWSER_RELOAD'),
            launchExternal: (type, port) => ipcRenderer.invoke('BROWSER_LAUNCH_EXTERNAL', type, port),
            connectExternal: (port) => ipcRenderer.invoke('BROWSER_CONNECT_EXTERNAL', port),
            switchMode: (mode) => ipcRenderer.invoke('BROWSER_SWITCH_MODE', mode),
            typeText: (selector, text, options) => ipcRenderer.invoke('BROWSER_TYPE_TEXT', selector, text, options),
            newTab: (url) => ipcRenderer.invoke('BROWSER_NEW_TAB', url),
            listTabs: () => ipcRenderer.invoke('BROWSER_LIST_TABS'),
            switchTab: (index) => ipcRenderer.invoke('BROWSER_SWITCH_TAB', index),
            closeTab: (index) => ipcRenderer.invoke('BROWSER_CLOSE_TAB', index)
        },
        // System control methods
        systemControl: {
            launchApp: (appName) => ipcRenderer.invoke('SYSTEM_LAUNCH_APP', appName)
        }
    }
) 