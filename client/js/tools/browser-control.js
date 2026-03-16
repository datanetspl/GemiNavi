import { ANNOTATIONS_SCRIPT } from './annotations-script.js';

/**
 * Tool for navigating to a specific URL
 */
export class NavigateToUrlTool {
    getDeclaration() {
        return {
            name: 'navigate_to_url',
            description: 'Navigate the browser to a specific URL',
            parameters: {
                type: 'OBJECT',
                properties: {
                    url: {
                        type: 'STRING',
                        description: 'The URL to navigate to (e.g., "https://www.google.com")'
                    }
                },
                required: ['url']
            }
        };
    }

    async execute({ url }) {
        console.info(`Navigating to: ${url}`);
        return await window.api.browserControl.navigate(url);
    }
}

/**
 * Tool for clicking an element on the page
 */
export class ClickElementTool {
    getDeclaration() {
        return {
            name: 'click_element',
            description: 'Click an element on the current page using a CSS selector or a label ID from show_link_annotations',
            parameters: {
                type: 'OBJECT',
                properties: {
                    selector: {
                        type: 'STRING',
                        description: 'The CSS selector of the element to click'
                    },
                    labelId: {
                        type: 'NUMBER',
                        description: 'The numeric label ID shown on screen'
                    }
                }
            }
        };
    }

    async execute({ selector, labelId }) {
        console.info(`Clicking element: ${selector || `label ${labelId}`}`);
        let script = '';
        if (labelId) {
            script = `
                (function() {
                    const element = document.querySelector('[data-gemini-label="${labelId}"]');
                    if (element) {
                        element.click();
                        return true;
                    }
                    return false;
                })()
            `;
        } else if (selector) {
            script = `
                (function() {
                    const element = document.querySelector('${selector}');
                    if (element) {
                        element.click();
                        return true;
                    }
                    return false;
                })()
            `;
        }
        const result = await window.api.browserControl.executeScript(script);
        return { success: result, selector, labelId };
    }
}

/**
 * Tool for scrolling the page
 */
export class ScrollPageTool {
    getDeclaration() {
        return {
            name: 'scroll_page',
            description: 'Scroll the current page up, down, top, or bottom',
            parameters: {
                type: 'OBJECT',
                properties: {
                    direction: {
                        type: 'STRING',
                        enum: ['up', 'down', 'top', 'bottom'],
                        description: 'The direction to scroll'
                    },
                    amount: {
                        type: 'NUMBER',
                        description: 'Amount to scroll in pixels (ignored for top/bottom)'
                    }
                },
                required: ['direction']
            }
        };
    }

    async execute({ direction, amount = 300 }) {
        console.info(`Scrolling ${direction} ${amount ? `by ${amount}px` : ''}`);
        let script = '';
        switch (direction) {
            case 'up':
                script = `window.scrollBy(0, -${amount})`;
                break;
            case 'down':
                script = `window.scrollBy(0, ${amount})`;
                break;
            case 'top':
                script = `window.scrollTo(0, 0)`;
                break;
            case 'bottom':
                script = `window.scrollTo(0, document.body.scrollHeight)`;
                break;
        }
        await window.api.browserControl.executeScript(script);
        return { success: true, direction };
    }
}

/**
 * Tool for showing link annotations
 */
export class ShowLinkAnnotationsTool {
    getDeclaration() {
        return {
            name: 'show_link_annotations',
            description: 'Inject visual labels (numbers) over interactive elements on the page. Use this to identify what can be clicked.',
        };
    }

    async execute() {
        console.info('Showing link annotations');
        const labels = await window.api.browserControl.executeScript(ANNOTATIONS_SCRIPT);
        return { success: true, labelsFound: labels.length, labels: labels };
    }
}

/**
 * Tool for removing link annotations
 */
export class RemoveAnnotationsTool {
    getDeclaration() {
        return {
            name: 'remove_annotations',
            description: 'Remove the visual labels from the page.',
        };
    }

    async execute() {
        console.info('Removing link annotations');
        const script = `
            (function() {
                const container = document.getElementById('gemini-annotations-container');
                if (container) {
                    container.remove();
                    return true;
                }
                return false;
            })()
        `;
        const result = await window.api.browserControl.executeScript(script);
        return { success: result };
    }
}

/**
 * Tool for going back in history
 */
export class GoBackTool {
    getDeclaration() {
        return {
            name: 'go_back',
            description: 'Go back to the previous page in history.',
        };
    }

    async execute() {
        console.info('Going back');
        return await window.api.browserControl.goBack();
    }
}

/**
 * Tool for going forward in history
 */
export class GoForwardTool {
    getDeclaration() {
        return {
            name: 'go_forward',
            description: 'Go forward to the next page in history.',
        };
    }

    async execute() {
        console.info('Going forward');
        return await window.api.browserControl.goForward();
    }
}

/**
 * Tool for launching an external browser
 */
export class LaunchBrowserTool {
    getDeclaration() {
        return {
            name: 'launch_browser',
            description: 'Launch an external browser (Chrome or Edge) with remote debugging enabled.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    browserType: {
                        type: 'STRING',
                        enum: ['chrome', 'edge'],
                        description: 'The type of browser to launch'
                    },
                    port: {
                        type: 'NUMBER',
                        description: 'Remote debugging port (default 9222)'
                    }
                },
                required: ['browserType']
            }
        };
    }

    async execute({ browserType, port = 9222 }) {
        console.info(`Gemini requested to launch ${browserType} on port ${port}`);
        return await window.api.browserControl.launchExternal(browserType, port);
    }
}

/**
 * Tool for typing text into an element
 */
export class TypeTextTool {
    getDeclaration() {
        return {
            name: 'type_text',
            description: 'Type text into an input field or textarea.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    selector: { type: 'STRING', description: 'CSS selector of the field' },
                    labelId: { type: 'NUMBER', description: 'Label ID from annotations' },
                    text: { type: 'STRING', description: 'Text to type' },
                    pressEnter: { type: 'BOOLEAN', description: 'Whether to press Enter after typing' }
                },
                required: ['text']
            }
        };
    }

    async execute({ selector, labelId, text, pressEnter = false }) {
        const targetSelector = labelId ? `[data-gemini-label="${labelId}"]` : selector;
        if (!targetSelector) throw new Error('Either selector or labelId is required');
        return await window.api.browserControl.typeText(targetSelector, text, { pressEnter });
    }
}

/**
 * Tool for filling out multiple form fields at once
 */
export class FillFormTool {
    getDeclaration() {
        return {
            name: 'fill_form',
            description: 'Fill multiple form fields at once.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    fields: {
                        type: 'ARRAY',
                        items: {
                            type: 'OBJECT',
                            properties: {
                                labelId: { type: 'NUMBER' },
                                selector: { type: 'STRING' },
                                value: { type: 'STRING' }
                            },
                            required: ['value']
                        }
                    }
                },
                required: ['fields']
            }
        };
    }

    async execute({ fields }) {
        for (const field of fields) {
            const sel = field.labelId ? `[data-gemini-label="${field.labelId}"]` : field.selector;
            await window.api.browserControl.typeText(sel, field.value, { pressEnter: false });
        }
        return { success: true, fieldsFilled: fields.length };
    }
}

/** Tab Management Tools */
export class NewTabTool {
    getDeclaration() {
        return {
            name: 'new_tab',
            description: 'Open a new browser tab.',
            parameters: {
                type: 'OBJECT',
                properties: { url: { type: 'STRING' } }
            }
        };
    }
    async execute({ url }) { return await window.api.browserControl.newTab(url); }
}

export class ListTabsTool {
    getDeclaration() {
        return { name: 'list_tabs', description: 'List all open browser tabs.' };
    }
    async execute() { return await window.api.browserControl.listTabs(); }
}

export class SwitchTabTool {
    getDeclaration() {
        return {
            name: 'switch_tab',
            description: 'Switch to a specific browser tab by index.',
            parameters: {
                type: 'OBJECT',
                properties: { index: { type: 'NUMBER' } },
                required: ['index']
            }
        };
    }
    async execute({ index }) { return await window.api.browserControl.switchTab(index); }
}

export class CloseTabTool {
    getDeclaration() {
        return {
            name: 'close_tab',
            description: 'Close a browser tab.',
            parameters: {
                type: 'OBJECT',
                properties: { index: { type: 'NUMBER' } }
            }
        };
    }
    async execute({ index }) { return await window.api.browserControl.closeTab(index); }
}
