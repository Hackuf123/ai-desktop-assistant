/**
 * OLIMIA AI Desktop Assistant - Main Entry Point
 * 
 * Electron main process for the desktop assistant
 * Features: AI Chat, SSH, Shell Commands, Python, Web Browsing, File Management
 */
require('dotenv').config();

const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

// Import OLIMIA Assistant
const OLIMIA = require('./assistant');

// Global reference
let mainWindow;
let olimia;

/**
 * Create the main application window
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        title: 'OLIMIA - AI Desktop Assistant',
        backgroundColor: '#1e1e2f',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
        icon: path.join(__dirname, 'icon.png'),
    });

    // Load the HTML interface
    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Open DevTools in development
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    // Handle window close
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Create application menu
    createMenu();

    console.log('[Main] Window created');
}

/**
 * Create application menu
 */
function createMenu() {
    const template = [
        {
            label: 'OLIMIA',
            submenu: [
                { label: 'About OLIMIA', role: 'about' },
                { type: 'separator' },
                { label: 'Quit', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
            ],
        },
        {
            label: 'Edit',
            submenu: [
                { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
                { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
                { type: 'separator' },
                { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
                { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
                { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
                { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' },
            ],
        },
        {
            label: 'View',
            submenu: [
                { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
                { label: 'Toggle DevTools', accelerator: 'F12', role: 'toggleDevTools' },
                { type: 'separator' },
                { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
                { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
                { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
                { type: 'separator' },
                { label: 'Full Screen', accelerator: 'F11', role: 'togglefullscreen' },
            ],
        },
        {
            label: 'Tools',
            submenu: [
                { 
                    label: 'AI Chat', 
                    accelerator: 'CmdOrCtrl+1',
                    click: () => mainWindow?.webContents.send('navigate', 'chat'),
                },
                { 
                    label: 'Terminal', 
                    accelerator: 'CmdOrCtrl+2',
                    click: () => mainWindow?.webContents.send('navigate', 'terminal'),
                },
                { 
                    label: 'Skills', 
                    accelerator: 'CmdOrCtrl+3',
                    click: () => mainWindow?.webContents.send('navigate', 'skills'),
                },
                { 
                    label: 'SSH', 
                    accelerator: 'CmdOrCtrl+4',
                    click: () => mainWindow?.webContents.send('navigate', 'ssh'),
                },
            ],
        },
        {
            label: 'Help',
            submenu: [
                { 
                    label: 'Documentation', 
                    click: () => {
                        const { shell } = require('electron');
                        shell.openExternal('https://github.com/hackuf123/ai-desktop-assistant');
                    },
                },
                { type: 'separator' },
                { label: 'View Logs', click: () => mainWindow?.webContents.send('show-logs') },
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

/**
 * Setup IPC handlers for main process
 */
function setupIPC() {
    // AI Chat
    ipcMain.handle('ai:ask', async (event, prompt, options) => {
        try {
            return await olimia.ask(prompt, options);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('ai:askStream', async (event, prompt, options) => {
        try {
            return await olimia.askStream(prompt, (chunk) => {
                mainWindow?.webContents.send('ai:chunk', chunk);
            }, options);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('ai:getStatus', async () => {
        return olimia.getAIStatus();
    });

    ipcMain.handle('ai:switchProvider', async (event, provider) => {
        return await olimia.switchProvider(provider);
    });

    // Shell Commands
    ipcMain.handle('shell:execute', async (event, command, options) => {
        try {
            return await olimia.runCommand(command, options);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('shell:getSystemInfo', async () => {
        return await olimia.getSystemInfo();
    });

    // Python
    ipcMain.handle('python:runScript', async (event, scriptPath, args, options) => {
        try {
            return await olimia.runPython(scriptPath, args, options);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('python:runCode', async (event, code, options) => {
        try {
            return await olimia.runPythonCode(code, options);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // File Management
    ipcMain.handle('file:read', async (event, filePath, options) => {
        try {
            return await olimia.readFile(filePath, options);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('file:write', async (event, filePath, content, options) => {
        try {
            return await olimia.writeFile(filePath, content, options);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('file:list', async (event, dirPath, options) => {
        try {
            return await olimia.listDir(dirPath, options);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Web Browser
    ipcMain.handle('web:search', async (event, query, limit) => {
        try {
            return await olimia.search(query, limit);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('web:fetch', async (event, url, options) => {
        try {
            return await olimia.fetch(url, options);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // SSH
    ipcMain.handle('ssh:connect', async (event, host, options) => {
        try {
            return await olimia.sshConnect(host, options);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('ssh:exec', async (event, command, host) => {
        try {
            return await olimia.sshExec(command, host);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('ssh:getStatus', async () => {
        return olimia.getSSHStatus();
    });

    // Skills
    ipcMain.handle('skills:list', async () => {
        return olimia.getSkills();
    });

    console.log('[Main] IPC handlers registered');
}

/**
 * App ready event
 */
app.on('ready', async () => {
    console.log('='.repeat(50));
    console.log('🤖 OLIMIA AI Desktop Assistant');
    console.log('='.repeat(50));

    // Initialize OLIMIA assistant
    olimia = OLIMIA;
    try {
        await olimia.initialize();
    } catch (error) {
        console.error('[Main] OLIMIA initialization error:', error.message);
    }

    // Setup IPC handlers
    setupIPC();

    // Create window
    createWindow();

    console.log('[Main] Application ready');
});

/**
 * Handle window-all-closed
 */
app.on('window-all-closed', async () => {
    console.log('[Main] All windows closed');
    
    // Cleanup
    if (olimia) {
        await olimia.dispose();
    }

    // Quit on all platforms
    app.quit();
});

/**
 * Handle activate (macOS)
 */
app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error) => {
    console.error('[Main] Uncaught Exception:', error);
});

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Main] Unhandled Rejection:', reason);
});
