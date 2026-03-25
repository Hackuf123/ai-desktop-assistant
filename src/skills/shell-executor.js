/**
 * Shell Command Skill - Execute Shell Commands
 * Provides ability to run shell commands on local system
 */
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class ShellExecutor {
  constructor() {
    this.name = 'shell';
    this.history = [];
    this.maxHistory = 100;
  }

  /**
   * Execute a shell command
   * @param {string} command - Command to execute
   * @param {Object} options - Options (cwd, timeout, etc.)
   * @returns {Promise<Object>} - Command result
   */
  async execute(command, options = {}) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const cwd = options.cwd || process.cwd();
      const timeout = options.timeout || 60000; // 60 seconds default

      console.log(`[Shell] Executing: ${command}`);

      const child = exec(command, { 
        cwd, 
        shell: true,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Command timed out'));
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        const result = {
          success: code === 0,
          code,
          stdout,
          stderr,
          duration,
          command,
        };

        // Add to history
        this.addToHistory(result);

        resolve(result);
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Execute a command with streaming output
   * @param {string} command - Command to execute
   * @param {Function} onData - Callback for stdout data
   * @param {Function} onError - Callback for stderr data
   * @returns {Promise<Object>} - Command result
   */
  async executeStream(command, onData, onError) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const cwd = process.cwd();

      console.log(`[Shell] Executing (stream): ${command}`);

      const child = exec(command, { cwd, shell: true });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        if (onData) onData(chunk);
      });

      child.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        if (onError) onError(chunk);
      });

      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        resolve({
          success: code === 0,
          code,
          stdout,
          stderr,
          duration,
          command,
        });
      });

      child.on('error', reject);
    });
  }

  /**
   * Spawn a long-running process
   * @param {string} command - Command to spawn
   * @param {Array} args - Arguments
   * @param {Object} options - Spawn options
   * @returns {Object} - Child process reference
   */
  spawn(command, args = [], options = {}) {
    const cwd = options.cwd || process.cwd();
    const child = spawn(command, args, { 
      cwd, 
      shell: true,
      stdio: options.interactive ? 'inherit' : ['pipe', 'pipe', 'pipe']
    });

    return {
      child,
      pid: child.pid,
      on: (event, callback) => child.on(event, callback),
      kill: () => child.kill(),
    };
  }

  /**
   * Add command to history
   */
  addToHistory(result) {
    this.history.push({
      ...result,
      timestamp: new Date().toISOString(),
    });

    // Keep history size limited
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
  }

  /**
   * Get command history
   */
  getHistory() {
    return this.history;
  }

  /**
   * Clear command history
   */
  clearHistory() {
    this.history = [];
  }

  /**
   * Get system information
   */
  async getSystemInfo() {
    const os = require('os');
    return {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      homeDir: os.homedir(),
      tempDir: os.tmpdir(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
    };
  }
}

module.exports = new ShellExecutor();
