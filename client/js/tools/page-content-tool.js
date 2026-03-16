/**
 * Tool for extracting the text content of a page and summarizing it using a cheaper standard text model.
 */
export class PageContentTool {
    getDeclaration() {
        return {
            name: 'summarize_page',
            description: 'Extract and summarize the main text content of the current web page using a secondary, cost-efficient text model. Use this to read long articles or get the gist of a page.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    focus: {
                        type: 'STRING',
                        description: 'Optional specific instruction for the summary (e.g., "Extract the recipe ingredients", "What are the main arguments?"). If omitted, provides a general summary.'
                    }
                }
            }
        };
    }

    async execute({ focus }) {
        console.info('Extracting page content for summarization...');
        const script = `
            (function() {
                // Try to find the main content area
                const selectors = ['article', 'main', '[role="main"]', '.post-content', '.content', '.article'];
                let mainElement = null;
                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el && el.innerText.length > 500) {
                        mainElement = el;
                        break;
                    }
                }

                // Fallback: use body if no main element found
                const target = mainElement || document.body;
                
                // Clone to avoid modifying the real page
                const clone = target.cloneNode(true);
                
                // Remove noise elements
                const noise = clone.querySelectorAll('script, style, nav, footer, iframe, aside, .ads, .sidebar');
                noise.forEach(el => el.remove());

                // Return cleaned text. We can grab up to 30,000 characters safely for the standard API.
                return clone.innerText.replace(/\\s+/g, ' ').trim().substring(0, 30000);
            })()
        `;
        
        try {
            const content = await window.api.browserControl.executeScript(script);
            
            if (!content || content.length < 50) {
                return { success: false, error: "Page content is empty or could not be extracted." };
            }

            console.info('Calling standard Gemini 2.5 Flash for summarization...');
            const apiKey = localStorage.getItem('apiKey');
            if (!apiKey) throw new Error("API Key not found");

            const prompt = focus 
                ? `Please read the following page text and focus strictly on this request: "${focus}"\n\nPage Text:\n${content}`
                : `Please provide a clear and concise summary of the following page text:\n\nPage Text:\n${content}`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    systemInstruction: {
                        parts: [{ text: "You are a fast, efficient text summarization assistant. Provide clean, well-formatted summaries." }]
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to call Gemini API');
            }

            const data = await response.json();
            const summary = data.candidates[0].content.parts[0].text;
            
            console.info('Summarization complete.');
            return { 
                success: true, 
                summary: summary 
            };
        } catch (error) {
            console.error('Summarization failed:', error);
            return { success: false, error: error.message };
        }
    }
}
