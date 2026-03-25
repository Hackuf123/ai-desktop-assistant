// Example usage of AI Desktop Assistant Skills
// This demonstrates how to use the Lemon AI-inspired automation capabilities

const { FileOrganizer, AppAutomator, TextProcessor, WebAutomator } = require('./modules');

async function demonstrateSkills() {
    console.log('🚀 AI Desktop Assistant Skills Demo\n');

    // 1. File Organization
    console.log('📁 File Organizer Demo:');
    const fileOrganizer = new FileOrganizer();
    const fileResults = await fileOrganizer.organizeFiles({
        sourceDir: './src',
        pattern: '*.js',
        action: 'scan'
    });
    console.log(`Found ${fileResults.files?.length || 0} JavaScript files\n`);

    // 2. App Automation
    console.log('🖥️ App Automator Demo:');
    const appAutomator = new AppAutomator();
    const apps = await appAutomator.getRunningApps();
    console.log(`Found ${apps.apps?.length || 0} running applications\n`);

    // 3. Text Processing
    console.log('📝 Text Processor Demo:');
    const textProcessor = new TextProcessor();
    const sampleText = 'This is a sample text for demonstration. It contains multiple sentences and can be processed in various ways.';
    const analysis = textProcessor.processText(sampleText, 'analyze');
    console.log(`Text analysis: ${analysis.result?.words || 0} words, ${analysis.result?.sentences || 0} sentences\n`);

    // 4. Web Automation
    console.log('🌐 Web Automator Demo:');
    const webAutomator = new WebAutomator();
    const searchResults = await webAutomator.searchWeb('AI desktop assistants', { maxResults: 2 });
    console.log(`Web search found ${searchResults.results?.length || 0} results\n`);

    console.log('✅ Skills demonstration completed!');
}

// Export for use in main application
module.exports = {
    demonstrateSkills,
    FileOrganizer,
    AppAutomator,
    TextProcessor,
    WebAutomator
};

// Run demo if called directly
if (require.main === module) {
    demonstrateSkills().catch(console.error);
}