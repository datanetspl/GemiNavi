export class GoogleSearchTool {
    
    getDeclaration() {
        return { 
            name: 'google_search',
            description: 'Search Google for a specific query',
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
        };
    }

    async execute({ query }) {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        console.info(`Searching Google for: ${query}`);
        return await window.api.browserControl.navigate(url);
    }
}
