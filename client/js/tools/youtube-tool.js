/**
 * Specialized tools for interacting with YouTube
 */
export class YouTubeTool {
    getDeclaration() {
        return [
            {
                name: 'youtube_control',
                description: 'Control YouTube video playback (play, pause, skip ad, etc.)',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        action: {
                            type: 'STRING',
                            enum: ['play', 'pause', 'toggle', 'skip_ad', 'mute', 'unmute'],
                            description: 'The playback action to perform'
                        }
                    },
                    required: ['action']
                }
            },
            {
                name: 'youtube_search',
                description: 'Search for a video on YouTube',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        query: {
                            type: 'STRING',
                            description: 'The search term'
                        }
                    },
                    required: ['query']
                }
            }
        ];
    }

    async execute(args) {
        const { action, query } = args;

        if (query) {
            const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            console.info(`Searching YouTube for: ${query}`);
            return await window.api.browserControl.navigate(url);
        }

        let script = '';
        switch (action) {
            case 'play':
                script = `document.querySelector('video')?.play()`;
                break;
            case 'pause':
                script = `document.querySelector('video')?.pause()`;
                break;
            case 'toggle':
                script = `(function() { const v = document.querySelector('video'); if(v.paused) v.play(); else v.pause(); })()`;
                break;
            case 'skip_ad':
                script = `(function() { 
                    const selectors = [
                        '.ytp-ad-skip-button-modern',
                        '.ytp-skip-ad-button',
                        '.ytp-ad-skip-button',
                        '.ytp-ad-skip-button-container button'
                    ];
                    for (const sel of selectors) {
                        const btn = document.querySelector(sel);
                        if (btn) {
                            btn.click();
                            return "Clicked skip button: " + sel;
                        }
                    }
                    // Fallback: Check for any button containing "Skip"
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const skipBtn = buttons.find(b => b.innerText && b.innerText.includes('Skip'));
                    if (skipBtn) {
                        skipBtn.click();
                        return "Clicked 'Skip' button by text";
                    }
                    return "No skip button currently visible";
                })()`;
                break;
            case 'mute':
                script = `document.querySelector('video').muted = true`;
                break;
            case 'unmute':
                script = `document.querySelector('video').muted = false`;
                break;
        }

        console.info(`YouTube Action: ${action}`);
        const result = await window.api.browserControl.executeScript(script);
        return { success: true, action, result };
    }
}
