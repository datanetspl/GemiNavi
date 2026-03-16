import { GeminiAgent } from './main/agent.js';
import { getWebsocketUrl, MODEL_SAMPLE_RATE } from './config/config.js';

import { GoogleSearchTool } from './tools/google-search.js';
import { NavigateToUrlTool, ClickElementTool, ScrollPageTool, ShowLinkAnnotationsTool, RemoveAnnotationsTool, GoBackTool, GoForwardTool, LaunchBrowserTool, TypeTextTool, FillFormTool, NewTabTool, ListTabsTool, SwitchTabTool, CloseTabTool } from './tools/browser-control.js';
import { PageContentTool } from './tools/page-content-tool.js';
import { ToolManager } from './tools/tool-manager.js';
import { ChatManager } from './chat/chat-manager.js';

import { setupEventListeners } from './dom/events.js';

import { YouTubeTool } from './tools/youtube-tool.js';

const url = getWebsocketUrl();

const toolManager = new ToolManager();
toolManager.registerTool('google_search', new GoogleSearchTool());
toolManager.registerTool('youtube', new YouTubeTool());
toolManager.registerTool('navigate_to_url', new NavigateToUrlTool());
toolManager.registerTool('click_element', new ClickElementTool());
toolManager.registerTool('scroll_page', new ScrollPageTool());
toolManager.registerTool('show_link_annotations', new ShowLinkAnnotationsTool());
toolManager.registerTool('remove_annotations', new RemoveAnnotationsTool());
toolManager.registerTool('go_back', new GoBackTool());
toolManager.registerTool('go_forward', new GoForwardTool());
toolManager.registerTool('launch_browser', new LaunchBrowserTool());
toolManager.registerTool('type_text', new TypeTextTool());
toolManager.registerTool('fill_form', new FillFormTool());
toolManager.registerTool('new_tab', new NewTabTool());
toolManager.registerTool('list_tabs', new ListTabsTool());
toolManager.registerTool('switch_tab', new SwitchTabTool());
toolManager.registerTool('close_tab', new CloseTabTool());
toolManager.registerTool('summarize_page', new PageContentTool());

const chatManager = new ChatManager();

const geminiAgent = new GeminiAgent({
    url,
    modelSampleRate: MODEL_SAMPLE_RATE,
    toolManager
});

// Handle chat-related events
geminiAgent.on('transcription', (transcript) => {
    chatManager.updateStreamingMessage(transcript);
});

geminiAgent.on('text_sent', (text) => {
    chatManager.finalizeStreamingMessage();
    chatManager.addUserMessage(text);
});

geminiAgent.on('interrupted', () => {
    chatManager.finalizeStreamingMessage();
    if (!chatManager.lastUserMessageType) {
        chatManager.addUserAudioMessage();
    }
});

geminiAgent.on('turn_complete', () => {
    chatManager.finalizeStreamingMessage();
});

geminiAgent.on('error', (error) => {
    console.error('⚠️ Agent Error:', error);
    alert('Connection Error: ' + (error.message || 'Check your API Key and Network'));
});

// Explicitly log connection progress
console.info('🚀 Initiating agent connection...');
geminiAgent.connect()
    .then(() => {
        console.info('✅ Agent connected successfully!');
    })
    .catch(err => {
        console.error('❌ Failed to connect agent:', err);
    });

setupEventListeners(geminiAgent);
