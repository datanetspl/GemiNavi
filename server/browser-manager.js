const puppeteer = require('puppeteer-core');
const { BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class BrowserManager {
    constructor() {
        this.mode = 'internal'; // 'internal' or 'external'
        this.browser = null;
        this.page = null;
        this.internalWindow = null;
        this.externalPort = 9222;
        this.externalProcess = null;
    }

    setInternalWindow(win) {
        this.internalWindow = win;
    }

    async setMode(mode) {
        if (this.mode === mode) return;
        if (this.mode === 'external') await this.disconnectExternal();
        this.mode = mode;
        console.info(`Browser mode switched to: ${mode}`);
    }

    _getBrowserPath(type) {
        const paths = {
            chrome: [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
            ],
            edge: [
                'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
            ]
        };
        for (const p of paths[type] || []) { if (fs.existsSync(p)) return p; }
        return null;
    }

    async launchExternal(type = 'chrome', port = 9222) {
        const browserPath = this._getBrowserPath(type);
        if (!browserPath) throw new Error(`Could not find ${type} installation path.`);
        this.externalPort = port;
        const args = [`--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check', '--user-data-dir=' + path.join(process.env.TEMP || '', 'gemini-live-browser-profile')];
        this.externalProcess = spawn(browserPath, args, { detached: true, stdio: 'ignore' });
        this.externalProcess.unref();
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await this.connectExternal(port);
    }

    async connectExternal(port = 9222) {
        try {
            this.externalPort = port;
            this.browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null });
            const pages = await this.browser.pages();
            this.page = pages[0] || (await this.browser.newPage());
            this.mode = 'external';
            return { success: true };
        } catch (error) {
            console.error('Failed to connect to external browser:', error);
            throw error;
        }
    }

    async disconnectExternal() {
        if (this.browser) {
            try { await this.browser.disconnect(); } catch (e) {}
            this.browser = null;
            this.page = null;
        }
    }

    /** Tab Management */
    async newTab(url = 'about:blank') {
        if (this.mode === 'external' && this.browser) {
            this.page = await this.browser.newPage();
            if (url !== 'about:blank') await this.page.goto(url);
            return { success: true, index: (await this.browser.pages()).length - 1 };
        }
        return { success: false, error: 'Only supported in external mode' };
    }

    async listTabs() {
        if (this.mode === 'external' && this.browser) {
            const pages = await this.browser.pages();
            return await Promise.all(pages.map(async (p, i) => ({
                index: i,
                title: await p.title(),
                url: p.url(),
                isActive: p === this.page
            })));
        }
        return [];
    }

    async switchTab(index) {
        if (this.mode === 'external' && this.browser) {
            const pages = await this.browser.pages();
            if (pages[index]) {
                this.page = pages[index];
                await this.page.bringToFront();
                return { success: true, title: await this.page.title() };
            }
        }
        return { success: false, error: 'Tab not found' };
    }

    async closeTab(index) {
        if (this.mode === 'external' && this.browser) {
            const pages = await this.browser.pages();
            const target = pages[index] || this.page;
            if (target) {
                await target.close();
                const remaining = await this.browser.pages();
                this.page = remaining[0];
                return { success: true };
            }
        }
        return { success: false };
    }

    async navigate(url) {
        if (this.mode === 'internal' && this.internalWindow) {
            if (url && !url.startsWith('http')) url = 'https://' + url;
            await this.internalWindow.loadURL(url);
        } else if (this.mode === 'external' && this.page) {
            if (url && !url.startsWith('http')) url = 'https://' + url;
            await this.page.goto(url, { waitUntil: 'networkidle2' });
        }
    }

    async typeText(selector, text, options = {}) {
        if (this.mode === 'external' && this.page) {
            await this.page.type(selector, text, { delay: 50 });
            if (options.pressEnter) await this.page.keyboard.press('Enter');
            return { success: true };
        } else if (this.mode === 'internal' && this.internalWindow) {
            // For internal, we inject a script
            const script = `
                (function() {
                    const el = document.querySelector('${selector}');
                    if (el) {
                        el.value = '${text.replace(/'/g, "\\'")}';
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        ${options.pressEnter ? "el.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true}));" : ""}
                        return true;
                    }
                    return false;
                })()
            `;
            const res = await this.internalWindow.webContents.executeJavaScript(script);
            return { success: res };
        }
    }

    async executeScript(script) {
        if (this.mode === 'internal' && this.internalWindow) {
            return await this.internalWindow.webContents.executeJavaScript(script);
        } else if (this.mode === 'external' && this.page) {
            return await this.page.evaluate(script);
        }
        throw new Error('No active browser/window to execute script');
    }

    async goBack() {
        if (this.mode === 'internal' && this.internalWindow) {
            if (this.internalWindow.webContents.canGoBack()) { this.internalWindow.webContents.goBack(); return true; }
        } else if (this.mode === 'external' && this.page) {
            await this.page.goBack(); return true;
        }
        return false;
    }

    async goForward() {
        if (this.mode === 'internal' && this.internalWindow) {
            if (this.internalWindow.webContents.canGoForward()) { this.internalWindow.webContents.goForward(); return true; }
        } else if (this.mode === 'external' && this.page) {
            await this.page.goForward(); return true;
        }
        return false;
    }

    async reload() {
        if (this.mode === 'internal' && this.internalWindow) this.internalWindow.webContents.reload();
        else if (this.mode === 'external' && this.page) await this.page.reload();
    }

    async getMediaSourceId() {
        if (this.mode === 'internal' && this.internalWindow) return this.internalWindow.getMediaSourceId();
        return null;
    }
}

module.exports = new BrowserManager();
