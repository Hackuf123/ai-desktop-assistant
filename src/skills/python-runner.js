/**
 * Python Script Runner Skill
 * Execute Python scripts and interact with Python interpreter
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class PythonRunner {
  constructor() {
    this.name = 'python';
    this.pythonCommands = ['python', 'python3', 'py'];
    this.pythonPath = null;
    this.history = [];
    this.maxHistory = 50;
  }

  /**
   * Initialize and find Python
   */
  async initialize() {
    this.pythonPath = await this.findPython();
    console.log(`[Python] Using: ${this.pythonPath}`);
    return !!this.pythonPath;
  }

  /**
   * Find available Python executable
   */
  async findPython() {
    for (const cmd of this.pythonCommands) {
      try {
        const result = await this.runSimpleCommand(`${cmd} --version`);
        if (result.success && result.stdout.includes('Python')) {
          return cmd;
        }
      } catch (e) {
        // Continue to next command
      }
    }
    return null;
  }

  /**
   * Run a simple Python command
   */
  runSimpleCommand(command) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, { shell: true });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });
      child.on('close', (code) => resolve({ success: code === 0, stdout, stderr, code }));
      child.on('error', reject);
    });
  }

  /**
   * Execute a Python script file
   * @param {string} scriptPath - Path to Python script
   * @param {Array} args - Script arguments
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Execution result
   */
  async executeScript(scriptPath, args = [], options = {}) {
    if (!this.pythonPath) {
      await this.initialize();
      if (!this.pythonPath) {
        throw new Error('Python not found on system');
      }
    }

    // Verify script exists
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script not found: ${scriptPath}`);
    }

    const startTime = Date.now();
    const workingDir = options.cwd || path.dirname(scriptPath);

    return new Promise((resolve, reject) => {
      const allArgs = [scriptPath, ...args];
      console.log(`[Python] Running: ${this.pythonPath} ${allArgs.join(' ')}`);

      const child = spawn(this.pythonPath, allArgs, {
        cwd: workingDir,
        env: { ...process.env, ...options.env },
        stdio: options.interactive ? 'inherit' : ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      if (!options.interactive) {
        child.stdout.on('data', (data) => { stdout += data.toString(); });
        child.stderr.on('data', (data) => { stderr += data.toString(); });
      }

      if (options.timeout) {
        setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error('Script execution timed out'));
        }, options.timeout);
      }

      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        const result = {
          success: code === 0,
          code,
          stdout,
          stderr,
          duration,
          scriptPath,
          args,
        };

        this.addToHistory(result);
        resolve(result);
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Execute Python code directly
   * @param {string} code - Python code to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Execution result
   */
  async executeCode(code, options = {}) {
    if (!this.pythonPath) {
      await this.initialize();
      if (!this.pythonPath) {
        throw new Error('Python not found on system');
      }
    }

    // Write code to temporary file
    const tempFile = path.join(os.tmpdir(), `olimia_temp_${Date.now()}.py`);
    
    try {
      // Add Python shebang if not present
      let fullCode = code;
      if (!code.startsWith('#!')) {
        fullCode = '#!/usr/bin/env python3\n' + code;
      }

      fs.writeFileSync(tempFile, fullCode, 'utf8');
      return await this.executeScript(tempFile, [], options);
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Run Python with pip install
   * @param {string} package - Package name to install
   * @returns {Promise<Object>} - Installation result
   */
  async installPackage(packageName) {
    return this.runSimpleCommand(`${this.pythonPath} -m pip install ${packageName}`);
  }

  /**
   * Run Python as REPL
   * @param {string} command - Single command to execute
   * @returns {Promise<Object>} - Result
   */
  async runRepl(command) {
    return this.runSimpleCommand(`${this.pythonPath} -c "${command.replace(/"/g, '\\"')}"`);
  }

  /**
   * Get Python version info
   */
  async getVersion() {
    const result = await this.runRepl('import sys; print(sys.version)');
    const ver = result.success ? result.stdout.trim() : 'Unknown';
    
    const pipResult = await this.runSimpleCommand(`${this.pythonPath} -m pip --version`);
    const pipVer = pipResult.success ? pipResult.stdout.trim() : 'Unknown';

    return {
      python: ver,
      pip: pipVer,
    };
  }

  /**
   * Check installed packages
   */
  async listPackages() {
    const result = await this.runSimpleCommand(`${this.pythonPath} -m pip list`);
    if (result.success) {
      return result.stdout.split('\n').filter(line => line.trim());
    }
    return [];
  }

  /**
   * Add to history
   */
  addToHistory(result) {
    this.history.push({
      ...result,
      timestamp: new Date().toISOString(),
    });

    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
  }

  /**
   * Get execution history
   */
  getHistory() {
    return this.history;
  }
}

module.exports = new PythonRunner();
