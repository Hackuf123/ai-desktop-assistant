const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class AppAutomator {
    constructor() {
        this.os = process.platform;
    }

    async launchApp(appName, options = {}) {
        try {
            let command;

            if (this.os === 'darwin') { // macOS
                command = `open -a "${appName}"`;
                if (options.args) {
                    command += ` --args ${options.args.join(' ')}`;
                }
            } else if (this.os === 'win32') { // Windows
                command = `start "" "${appName}"`;
                if (options.args) {
                    command += ` ${options.args.join(' ')}`;
                }
            } else if (this.os === 'linux') { // Linux
                command = `${appName}`;
                if (options.args) {
                    command += ` ${options.args.join(' ')}`;
                }
            }

            const { stdout, stderr } = await execAsync(command);
            return {
                success: true,
                app: appName,
                platform: this.os,
                output: stdout,
                errors: stderr
            };
        } catch (error) {
            return { success: false, app: appName, error: error.message };
        }
    }

    async closeApp(appName) {
        try {
            let command;

            if (this.os === 'darwin') {
                command = `osascript -e 'tell application "${appName}" to quit'`;
            } else if (this.os === 'win32') {
                command = `taskkill /IM "${appName}.exe" /F`;
            } else if (this.os === 'linux') {
                command = `pkill -f "${appName}"`;
            }

            const { stdout, stderr } = await execAsync(command);
            return {
                success: true,
                app: appName,
                action: 'closed',
                output: stdout,
                errors: stderr
            };
        } catch (error) {
            return { success: false, app: appName, error: error.message };
        }
    }

    async takeScreenshot(options = {}) {
        const { filename = `screenshot_${Date.now()}.png`, directory = '.' } = options;

        try {
            let command;
            const filepath = path.join(directory, filename);

            if (this.os === 'darwin') {
                command = `screencapture "${filepath}"`;
            } else if (this.os === 'win32') {
                // Windows screenshot using PowerShell
                command = `powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('%{PRTSC}'); Start-Sleep -Milliseconds 500; $img = [System.Windows.Forms.Clipboard]::GetImage(); $img.Save('${filepath}')"`;
            } else if (this.os === 'linux') {
                command = `scrot "${filepath}"`;
            }

            const { stdout, stderr } = await execAsync(command);
            return {
                success: true,
                filepath,
                platform: this.os,
                output: stdout,
                errors: stderr
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async controlVolume(action, level = null) {
        try {
            let command;

            if (this.os === 'darwin') {
                if (action === 'up') command = 'osascript -e "set volume output volume (output volume of (get volume settings) + 10)"';
                else if (action === 'down') command = 'osascript -e "set volume output volume (output volume of (get volume settings) - 10)"';
                else if (action === 'set' && level !== null) command = `osascript -e "set volume output volume ${level}"`;
                else if (action === 'mute') command = 'osascript -e "set volume output muted true"';
                else if (action === 'unmute') command = 'osascript -e "set volume output muted false"';
            } else if (this.os === 'win32') {
                if (action === 'up') command = 'nircmd.exe changesysvolume 3277';
                else if (action === 'down') command = 'nircmd.exe changesysvolume -3277';
                else if (action === 'set' && level !== null) command = `nircmd.exe setsysvolume ${Math.round(level * 65535 / 100)}`;
                else if (action === 'mute') command = 'nircmd.exe mutesysvolume 1';
                else if (action === 'unmute') command = 'nircmd.exe mutesysvolume 0';
            } else if (this.os === 'linux') {
                if (action === 'up') command = 'amixer -D pulse sset Master 10%+';
                else if (action === 'down') command = 'amixer -D pulse sset Master 10%-';
                else if (action === 'set' && level !== null) command = `amixer -D pulse sset Master ${level}%`;
                else if (action === 'mute') command = 'amixer -D pulse sset Master mute';
                else if (action === 'unmute') command = 'amixer -D pulse sset Master unmute';
            }

            if (command) {
                const { stdout, stderr } = await execAsync(command);
                return {
                    success: true,
                    action,
                    level,
                    platform: this.os,
                    output: stdout,
                    errors: stderr
                };
            } else {
                return { success: false, error: 'Unsupported action or platform' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async sendKeyboardShortcut(shortcut) {
        // Simulate keyboard shortcuts
        try {
            let command;

            if (this.os === 'darwin') {
                // Use AppleScript for macOS
                const keyMap = {
                    'cmd+c': 'command "c"',
                    'cmd+v': 'command "v"',
                    'cmd+a': 'command "a"',
                    'cmd+z': 'command "z"',
                    'cmd+shift+z': 'command shift "z"'
                };

                if (keyMap[shortcut]) {
                    command = `osascript -e 'tell application "System Events" to keystroke ${keyMap[shortcut]}'`;
                }
            } else if (this.os === 'win32') {
                // Use PowerShell for Windows
                const keyMap = {
                    'ctrl+c': '^c',
                    'ctrl+v': '^v',
                    'ctrl+a': '^a',
                    'ctrl+z': '^z'
                };

                if (keyMap[shortcut]) {
                    command = `powershell -command "[System.Windows.Forms.SendKeys]::SendWait('${keyMap[shortcut]}')"'`;
                }
            }

            if (command) {
                const { stdout, stderr } = await execAsync(command);
                return {
                    success: true,
                    shortcut,
                    platform: this.os,
                    output: stdout,
                    errors: stderr
                };
            } else {
                return { success: false, error: 'Unsupported shortcut or platform' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getRunningApps() {
        try {
            let command;

            if (this.os === 'darwin') {
                command = 'ps aux | grep -E "\\.app/" | grep -v grep | awk \'{print $11}\' | sed \'s/.*\\///\' | sed \'s/\\.app//\'';
            } else if (this.os === 'win32') {
                command = 'tasklist /FI "IMAGENAME ne System" /FI "IMAGENAME ne svchost.exe" /FO CSV | findstr /V "Image Name"';
            } else if (this.os === 'linux') {
                command = 'ps aux --no-headers | awk \'{print $11}\' | sort | uniq';
            }

            const { stdout, stderr } = await execAsync(command);
            const apps = stdout.trim().split('\n').filter(app => app.trim());

            return {
                success: true,
                platform: this.os,
                apps: apps,
                count: apps.length
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = AppAutomator;