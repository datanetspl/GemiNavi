const { exec } = require('child_process');

class SystemManager {
    constructor() {
        this.appMap = {
            'word': 'start winword',
            'excel': 'start excel',
            'powerpoint': 'start powerpnt',
            'notepad': 'start notepad',
            'calculator': 'start calc',
            'chrome': 'start msedge', // MS Edge is often standard
            'edge': 'start msedge',
            'outlook': 'start outlook',
            'explorer': 'start explorer'
        };
        this.lastLaunchedApp = null;
        this.lastLaunchTime = 0;
    }

    async launchApp(appName) {
        const now = Date.now();
        const name = appName.toLowerCase();

        // Stricter De-bounce: Prevent launching the same app within 10 seconds 
        // to avoid Gemini "re-confirming" loops.
        if (this.lastLaunchedApp === name && (now - this.lastLaunchTime) < 10000) {
            console.info(`💻 System: Filtered redundant launch for ${appName}`);
            return { success: true, message: "App already launched recently" };
        }

        this.lastLaunchedApp = name;
        this.lastLaunchTime = now;

        return new Promise((resolve) => {
            const command = this.appMap[name] || `start ${appName}`;
            console.info(`💻 System: Launching ${appName}...`);
            
            exec(command, (error) => {
                if (error) {
                    console.error(`❌ Failed to launch ${appName}:`, error);
                    resolve({ success: false, error: error.message });
                } else {
                    resolve({ success: true, launched: appName });
                }
            });
        });
    }

    /**
     * Searches for files in common Windows folders
     */
    async findFiles(query) {
        return new Promise((resolve) => {
            console.info(`💻 System: Searching for files matching: ${query}...`);
            
            // Search in Desktop, Documents, and Downloads
            const searchPaths = [
                "$HOME\\Desktop",
                "$HOME\\Documents",
                "$HOME\\Downloads"
            ].join(',');

            // PowerShell command to find top 10 files matching query
            const psCommand = `powershell.exe -Command "Get-ChildItem -Path ${searchPaths} -Filter '*${query}*' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 10 | ForEach-Object { @{ name=$_.Name; path=$_.FullName; lastModified=$_.LastWriteTime } | ConvertTo-Json }"`;

            exec(psCommand, (error, stdout) => {
                if (error && !stdout) {
                    console.error('❌ File search failed:', error);
                    resolve({ success: false, error: error.message });
                } else {
                    try {
                        // PowerShell output might be multiple JSON objects or an array
                        const results = stdout.trim().split('\\n').filter(l => l).map(l => JSON.parse(l));
                        resolve({ success: true, files: results });
                    } catch (e) {
                        // If parsing fails, return raw output or empty
                        resolve({ success: true, files: [], raw: stdout });
                    }
                }
            });
        });
    }
}

module.exports = new SystemManager();
