/**
 * Managing class where tools can be registered for easier use
 * Each tool must implement execute() and getDeclaration() methods.
 */

export class ToolManager {
    /**
     * Initializes a new ToolManager instance
     */
    constructor() {
        this.tools = new Map(); // name -> toolInstance
    }

    /**
     * Registers a new tool in the tool registry.
     */
    registerTool(name, toolInstance) {
        const decl = toolInstance.getDeclaration();
        if (Array.isArray(decl)) {
            // Tool defines multiple functions
            decl.forEach(d => {
                this.tools.set(d.name, toolInstance);
                console.info(`Sub-tool ${d.name} registered`);
            });
        } else {
            this.tools.set(name, toolInstance);
            console.info(`Tool ${name} registered successfully`);
        }
    }

    /**
     * Collects and returns declarations from all registered tools.
     */
    getToolDeclarations() {
        const allDeclarations = [];
        const seen = new Set();

        this.tools.forEach((tool) => {
            const decl = tool.getDeclaration();
            if (Array.isArray(decl)) {
                decl.forEach(d => {
                    if (!seen.has(d.name)) {
                        allDeclarations.push(d);
                        seen.add(d.name);
                    }
                });
            } else if (decl && !seen.has(decl.name)) {
                allDeclarations.push(decl);
                seen.add(decl.name);
            }
        });

        return allDeclarations;
    }

    /**
     * Parses tool arguments and runs execute() method of the requested tool.
     */
    async handleToolCall(functionCall) {
        const { name, args, id } = functionCall;
        console.info(`Handling tool call: ${name}`, { args });

        const tool = this.tools.get(name);
        if (!tool) {
            return { output: null, id, error: `Tool ${name} not found` };
        }

        try {
            const result = await tool.execute(args);
            return {
                output: result,
                id: id,
                error: null
            }
        } catch (error) {
            console.error(`Tool execution failed: ${name}`, error);
            return {
                output: null,
                id: id,
                error: error.message
            };
        }
    }
}
