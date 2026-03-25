// Module exports for AI Desktop Assistant
const DataAnalyzer = require('./data-analyzer');
const EmailHandler = require('./email-handler');
const TaskScheduler = require('./task-scheduler');
const PackageManager = require('./package-manager');

// Skills - Lemon AI inspired automation capabilities
const { FileOrganizer, AppAutomator, TextProcessor, WebAutomator } = require('../skills');
const VoiceController = require('./voice-controller');

module.exports = {
    // Core modules
    DataAnalyzer,
    EmailHandler,
    TaskScheduler,
    PackageManager,

    // Skills
    FileOrganizer,
    AppAutomator,
    TextProcessor,
    WebAutomator,

    // Voice control
    VoiceController
};