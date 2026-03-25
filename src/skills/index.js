// OLIMIA AI Desktop Assistant - Skills Exports
// All automation capabilities in one place

// Original Skills
const FileOrganizer = require('./file-organizer');
const AppAutomator = require('./app-automator');
const TextProcessor = require('./text-processor');
const WebAutomator = require('./web-automator');

// New Skills
const ShellExecutor = require('./shell-executor');
const PythonRunner = require('./python-runner');
const FileManager = require('./file-manager');
const WebBrowser = require('./web-browser');

module.exports = {
    // Original Skills
    FileOrganizer,
    AppAutomator,
    TextProcessor,
    WebAutomator,
    
    // New Skills
    ShellExecutor,
    PythonRunner,
    FileManager,
    WebBrowser,
    
    // Skill Categories
    automation: {
        AppAutomator,
        FileOrganizer,
        WebAutomator,
    },
    processing: {
        TextProcessor,
    },
    execution: {
        ShellExecutor,
        PythonRunner,
    },
    management: {
        FileManager,
        WebBrowser,
    },
};
