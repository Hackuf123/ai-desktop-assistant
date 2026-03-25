const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class VoiceController {
    constructor({ AppAutomator, WebAutomator, TextProcessor, shell }) {
        this.appAutomator = new AppAutomator();
        this.webAutomator = new WebAutomator();
        this.textProcessor = new TextProcessor(process.env.OPENAI_API_KEY || null);
        this.shell = shell;
    }

    async processTextCommand(text) {
        const normalized = text.toLowerCase().trim();

        if (normalized.startsWith('open youtube')) {
            return this.handleYoutubeCommand(normalized);
        }

        if (normalized.includes('weather')) {
            return this.handleWeatherCommand(normalized);
        }

        if (normalized.includes('news')) {
            return this.handleNewsCommand(normalized);
        }

        if (normalized.startsWith('open ') || normalized.startsWith('launch ')) {
            return this.handleAppCommand(normalized);
        }

        if (normalized.startsWith('run npm') || normalized.startsWith('install')) {
            return this.handlePackageCommand(normalized);
        }

        // Fallback: use AI to comprehend command and choose action
        return this.handleFallbackCommand(text);
    }

    async handleYoutubeCommand(command) {
        const channelMatch = command.match(/(?:channel|for)\s+([\w\s]+)/i);
        let query;

        if (channelMatch && channelMatch[1]) {
            query = channelMatch[1].trim();
        } else {
            const afterYoutube = command.replace('open youtube', '').replace('on youtube', '').trim();
            query = afterYoutube || 'trending';
        }

        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        await this.shell.openExternal(url);

        return {
            success: true,
            message: `Opened YouTube search for "${query}"`,
            url
        };
    }

    async handleWeatherCommand(command) {
        const locationMatch = command.match(/weather (?:in )?([\w\s]+)/i);
        const location = (locationMatch && locationMatch[1]) ? locationMatch[1].trim() : 'your location';

        // Open weather report webpage in default browser
        const query = location === 'your location' ? 'https://wttr.in/' : `https://wttr.in/${encodeURIComponent(location)}`;
        await this.shell.openExternal(query);

        const check = await this.webAutomator.getWeather(location === 'your location' ? '' : location);

        return {
            success: true,
            message: `Opened weather report for ${location}.`,
            weather: check
        };
    }

    async handleNewsCommand(command) {
        const newsUrl = 'https://news.google.com';
        await this.shell.openExternal(newsUrl);

        return {
            success: true,
            message: 'Opened news page.',
            url: newsUrl
        };
    }

    async handleAppCommand(command) {
        let target = command;

        if (target.startsWith('open ')) target = target.replace('open ', '');
        if (target.startsWith('launch ')) target = target.replace('launch ', '');
        if (target.startsWith('please ')) target = target.replace('please ', '');

        const appName = target.trim();
        if (!appName) {
            return { success: false, message: 'No app name found in voice command.' };
        }

        const result = await this.appAutomator.launchApp(appName);

        return {
            success: result.success,
            message: result.success ? `Launched app: ${appName}` : `Failed to launch app: ${appName}. Error: ${result.error}`,
            details: result
        };
    }

    async handlePackageCommand(command) {
        const pkgManager = /pip/.test(command) ? 'pip' : 'npm';
        const pkgMatch = command.match(/(?:install|run\s*npm\s*install)\s+([\w@\-/]+)/);
        const packageName = pkgMatch ? pkgMatch[1] : '';

        if (!packageName) {
            return { success: false, message: 'Package name not recognized.' };
        }

        const manager = require('./package-manager');
        const pm = new manager();
        const result = await pm.installPackages(packageName, pkgManager);

        return {
            success: result.success,
            message: result.success ? `Installed package ${packageName} via ${pkgManager}` : `Package install failed: ${result.error}`,
            details: result
        };
    }

    async handleFallbackCommand(text) {
        const aiResult = await this.textProcessor.processText(text, 'summarize', { maxLength: 120 });
        return {
            success: true,
            message: 'Fallback AI action (summary) completed.',
            aiResult
        };
    }
}

module.exports = VoiceController;