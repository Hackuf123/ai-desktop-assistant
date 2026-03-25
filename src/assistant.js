/**
 * OLIMIA - The Ultimate AI Desktop Assistant
 * Main Assistant Module
 * 
 * Features:
 * - Multiple AI Providers (Ollama, Groq, LM Studio)
 * - SSH Connection Management
 * - Shell Command Execution
 * - Python Script Execution
 * - Web Browsing & Search
 * - File Management
 * - Voice Control
 * - Task Scheduling
 */
require('dotenv').config();

const AIManager = require('./ai/ai-manager');
const { sshManager } = require('./ssh/ssh-manager');
const Skills = require('./skills');

// Skill instances
let shellExecutor;
let pythonRunner;
let fileManager;
let webBrowser;

/**
 * OLIMIA Assistant Core
 */
class OLIMIA {
  constructor() {
    this.name = 'OLIMIA';
    this.version = '1.0.0';
    this.initialized = false;
    this.config = {
      provider: process.env.DEFAULT_AI_PROVIDER || 'ollama',
      maxTokens: parseInt(process.env.MAX_TOKENS) || 4096,
      temperature: parseFloat(process.env.TEMPERATURE) || 0.7,
    };
  }

  /**
   * Initialize the assistant
   */
  async initialize() {
    console.log('='.repeat(50));
    console.log(`🤖 ${this.name} v${this.version} - Initializing...`);
    console.log('='.repeat(50));

    // Initialize AI providers
    console.log('\n[1/5] Initializing AI providers...');
    await AIManager.initialize();
    console.log(`    Active: ${AIManager.getStatus().active}`);

    // Initialize SSH
    console.log('\n[2/5] Initializing SSH manager...');
    await sshManager.initialize();
    console.log(`    SSH Ready`);

    // Initialize skills
    console.log('\n[3/5] Loading skills...');
    shellExecutor = Skills.ShellExecutor;
    pythonRunner = Skills.PythonRunner;
    await pythonRunner.initialize();
    fileManager = Skills.FileManager;
    webBrowser = Skills.WebBrowser;
    console.log('    ✓ Shell Executor');
    console.log('    ✓ Python Runner');
    console.log('    ✓ File Manager');
    console.log('    ✓ Web Browser');

    this.initialized = true;
    console.log('\n' + '='.repeat(50));
    console.log(`✅ ${this.name} ready!`);
    console.log('='.repeat(50));

    return true;
  }

  /**
   * Process a user query
   */
  async ask(prompt, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const result = await AIManager.query(prompt, {
        maxTokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature || this.config.temperature,
        model: options.model,
      });
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Process a user query with streaming
   */
  async askStream(prompt, onChunk, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    return AIManager.queryStream(prompt, onChunk, {
      maxTokens: options.maxTokens || this.config.maxTokens,
      temperature: options.temperature || this.config.temperature,
      model: options.model,
    });
  }

  /**
   * Execute a shell command
   */
  async runCommand(command, options = {}) {
    return shellExecutor.execute(command, options);
  }

  /**
   * Execute a Python script
   */
  async runPython(scriptPath, args = [], options = {}) {
    return pythonRunner.executeScript(scriptPath, args, options);
  }

  /**
   * Execute Python code directly
   */
  async runPythonCode(code, options = {}) {
    return pythonRunner.executeCode(code, options);
  }

  /**
   * Connect to SSH server
   */
  async sshConnect(host, options = {}) {
    // Use default host from config or environment
    const config = {
      host: host || process.env.SSH_HOST || 'olimia',
      port: options.port || parseInt(process.env.SSH_PORT) || 22,
      username: options.username || process.env.SSH_USER || 'root',
    };
    return await sshManager.getConnection();
  }

  /**
   * Execute command via SSH
   */
  async sshExec(command, host = 'default') {
    const conn = await sshManager.getConnection();
    if (!conn || !conn.isConnected) {
      throw new Error('SSH not connected');
    }
    return await conn.exec(command);
  }

  /**
   * Search the web
   */
  async search(query, limit = 10) {
    return webBrowser.search(query, limit);
  }

  /**
   * Fetch a web page
   */
  async fetch(url, options = {}) {
    return webBrowser.fetch(url, options);
  }

  /**
   * Read a file
   */
  async readFile(filePath, options = {}) {
    return fileManager.readFile(filePath, options);
  }

  /**
   * Write to a file
   */
  async writeFile(filePath, content, options = {}) {
    return fileManager.writeFile(filePath, content, options);
  }

  /**
   * List directory contents
   */
  async listDir(dirPath, options = {}) {
    return fileManager.list(dirPath, options);
  }

  /**
   * Get system information
   */
  async getSystemInfo() {
    return shellExecutor.getSystemInfo();
  }

  /**
   * Get AI provider status
   */
  getAIStatus() {
    return AIManager.getStatus();
  }

  /**
   * Get SSH status
   */
  getSSHStatus() {
    return sshManager.getStatus();
  }

  /**
   * Switch AI provider
   */
  async switchProvider(providerName) {
    return AIManager.switchProvider(providerName);
  }

  /**
   * Get available skills
   */
  getSkills() {
    return [
      { name: 'ask', description: 'Ask AI a question' },
      { name: 'runCommand', description: 'Execute shell command' },
      { name: 'runPython', description: 'Run Python script' },
      { name: 'runPythonCode', description: 'Execute Python code' },
      { name: 'sshConnect', description: 'Connect to SSH server' },
      { name: 'sshExec', description: 'Execute command via SSH' },
      { name: 'search', description: 'Search the web' },
      { name: 'fetch', description: 'Fetch web page' },
      { name: 'readFile', description: 'Read file' },
      { name: 'writeFile', description: 'Write file' },
      { name: 'listDir', description: 'List directory' },
      { name: 'getSystemInfo', description: 'Get system info' },
    ];
  }

  /**
   * Cleanup resources
   */
  async dispose() {
    await AIManager.dispose();
    await sshManager.disconnect();
    this.initialized = false;
    console.log(`[${this.name}] Disposed`);
  }
}

// Export singleton instance
module.exports = new OLIMIA();
