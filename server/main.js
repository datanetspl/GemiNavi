const { app, BrowserWindow, ipcMain, desktopCapturer, session } = require('electron')
const path = require('path')
const browserManager = require('./browser-manager')
const systemManager = require('./system-manager')

let mainWindow;

function createMainWindow () {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 400, // Narrow window for the agent UI
        height: 800,
        x: 0,
        y: 0,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })

    // Auto-grant permissions for mic and screen
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
        return true; 
    });

    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(true); 
    });

    // Check for remote URL environment variable
    const remoteUrl = process.env.APP_URL;
    if (remoteUrl) {
        console.info(`🌍 Loading remote client from: ${remoteUrl}`);
        mainWindow.loadURL(remoteUrl);
    } else {
        console.info('🏠 Loading local client');
        mainWindow.loadFile(path.join(__dirname, '../client/index.html'));
    }
}

function createBrowserWindow (url = 'https://www.google.com') {
    if (browserManager.internalWindow) {
        browserManager.internalWindow.focus();
        return;
    }

    const win = new BrowserWindow({
        width: 1000,
        height: 800,
        x: 410,
        y: 0,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    })

    win.loadURL(url);
    browserManager.setInternalWindow(win);
    browserManager.setMode('internal');

    // Notify main window of URL changes
    win.webContents.on('did-navigate', (event, newUrl) => {
        if (mainWindow) {
            mainWindow.webContents.send('BROWSER_URL_CHANGED', newUrl);
        }
    });

    win.webContents.on('did-navigate-in-page', (event, newUrl) => {
        if (mainWindow) {
            mainWindow.webContents.send('BROWSER_URL_CHANGED', newUrl);
        }
    });

    win.on('closed', () => {
        browserManager.setInternalWindow(null);
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
    createMainWindow()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})

// External browser control
ipcMain.handle('BROWSER_LAUNCH_EXTERNAL', async (event, type, port) => {
    try {
        return await browserManager.launchExternal(type, port);
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('BROWSER_CONNECT_EXTERNAL', async (event, port) => {
    try {
        return await browserManager.connectExternal(port);
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('BROWSER_SWITCH_MODE', async (event, mode) => {
    await browserManager.setMode(mode);
    return { success: true, mode };
});

// Handle browser navigation
ipcMain.handle('BROWSER_NAVIGATE', async (event, url) => {
    if (browserManager.mode === 'internal' && !browserManager.internalWindow) {
        createBrowserWindow(url);
    } else {
        await browserManager.navigate(url);
    }
    return { success: true, url };
})

// Navigation controls
ipcMain.handle('BROWSER_BACK', async () => {
    const success = await browserManager.goBack();
    return { success };
});

ipcMain.handle('BROWSER_FORWARD', async () => {
    const success = await browserManager.goForward();
    return { success };
});

ipcMain.handle('BROWSER_RELOAD', async () => {
    await browserManager.reload();
    return { success: true };
});

// Get browser source ID for screen sharing
ipcMain.handle('GET_BROWSER_SOURCE_ID', async () => {
    return await browserManager.getMediaSourceId();
});

// New handlers
ipcMain.handle('BROWSER_TYPE_TEXT', async (event, selector, text, options) => {
    return await browserManager.typeText(selector, text, options);
});

ipcMain.handle('BROWSER_NEW_TAB', async (event, url) => {
    return await browserManager.newTab(url);
});

ipcMain.handle('BROWSER_LIST_TABS', async () => {
    return await browserManager.listTabs();
});

ipcMain.handle('BROWSER_SWITCH_TAB', async (event, index) => {
    return await browserManager.switchTab(index);
});

ipcMain.handle('BROWSER_CLOSE_TAB', async (event, index) => {
    return await browserManager.closeTab(index);
});

// Handle script execution in browser window
ipcMain.handle('BROWSER_EXECUTE_SCRIPT', async (event, script) => {
    try {
        return await browserManager.executeScript(script);
    } catch (error) {
        console.error('Error executing script in browser:', error);
        throw error;
    }
})

// System control handlers
ipcMain.handle('SYSTEM_LAUNCH_APP', async (event, appName) => {
    return await systemManager.launchApp(appName);
});

// Handle get sources request
ipcMain.handle('GET_SOURCES', async (event) => {
    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen', 'window'],
            thumbnailSize: { width: 0, height: 0 },
            fetchWindowIcons: true
        });
        return sources;
    } catch (error) {
        console.error('Error getting sources:', error);
        throw error;
    }
}) 
