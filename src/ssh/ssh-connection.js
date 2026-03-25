const { Client } = require('ssh2');

/**
 * SSH Connection Wrapper
 * Manages individual SSH connections with keep-alive and reconnection support
 * Uses the ssh-ed25519 key provided by the user
 */
class SSHConnection {
  constructor(config) {
    this.config = {
      host: config.host || process.env.SSH_HOST || 'olimia',
      port: config.port || parseInt(process.env.SSH_PORT) || 22,
      username: config.username || process.env.SSH_USER || 'root',
      privateKey: config.privateKey || this.getDefaultKey(),
      readyTimeout: config.readyTimeout || 20000,
      keepaliveInterval: config.keepaliveInterval || 30000,
    };
    
    this.client = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  /**
   * Get default SSH key from environment
   * Uses the ssh-ed25519 key provided by user
   */
  getDefaultKey() {
    const envKey = process.env.SSH_PRIVATE_KEY;
    if (envKey) {
      console.log('[SSH] Using SSH key from environment');
      return envKey;
    }
    
    // No default key - must be configured
    console.warn('[SSH] No SSH key configured. Set SSH_PRIVATE_KEY in .env');
    return null;
  }

  /**
   * Connect to SSH server
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve(true);
        return;
      }

      if (this.isConnecting) {
        // Wait for existing connection attempt
        const checkConnection = setInterval(() => {
          if (this.isConnected) {
            clearInterval(checkConnection);
            resolve(true);
          }
        }, 100);
        return;
      }

      if (!this.config.privateKey) {
        reject(new Error('SSH key not configured. Set SSH_PRIVATE_KEY in .env'));
        return;
      }

      this.isConnecting = true;
      this.client = new Client();

      this.client.on('ready', () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        console.log(`[SSH] Connected to ${this.config.host}:${this.config.port}`);
        resolve(true);
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.isConnecting = false;
        console.error(`[SSH] Connection error: ${err.message}`);
        reject(err);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        console.log(`[SSH] Connection closed to ${this.config.host}`);
      });

      this.client.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
        // Handle keyboard-interactive authentication
        console.log(`[SSH] Keyboard interactive: ${name}`);
        // Usually need to respond with password if prompted
        finish([]);
      });

      this.client.on('banner', (message) => {
        console.log(`[SSH] Banner: ${message}`);
      });

      console.log(`[SSH] Connecting to ${this.config.host}:${this.config.port} as ${this.config.username}...`);
      this.client.connect(this.config);
    });
  }

  /**
   * Execute a command on the remote server
   */
  exec(command) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.client) {
        reject(new Error('SSH not connected'));
        return;
      }

      this.client.exec(command, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        let stdout = '';
        let stderr = '';

        stream.on('close', (code, signal) => {
          resolve({ 
            stdout, 
            stderr, 
            code,
            signal,
          });
        });

        stream.on('data', (data) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      });
    });
  }

  /**
   * Send command and get streaming response
   */
  execStream(command, onData, onError) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.client) {
        reject(new Error('SSH not connected'));
        return;
      }

      this.client.exec(command, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        let stdout = '';
        let stderr = '';

        stream.on('close', (code, signal) => {
          resolve({ 
            stdout, 
            stderr, 
            code,
            signal,
          });
        });

        stream.on('data', (data) => {
          const chunk = data.toString();
          stdout += chunk;
          if (onData) onData(chunk);
        });

        stream.stderr.on('data', (data) => {
          const chunk = data.toString();
          stderr += chunk;
          if (onError) onError(chunk);
        });
      });
    });
  }

  /**
   * Execute command with shell (interactive)
   */
  shell(options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.client) {
        reject(new Error('SSH not connected'));
        return;
      }

      this.client.shell(options, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        let stdout = '';
        let stderr = '';

        stream.on('close', (code, signal) => {
          resolve({ 
            stdout, 
            stderr, 
            code,
            signal,
          });
        });

        stream.on('data', (data) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        // Return stream for interactive use
        resolve({ 
          stream,
          stdout, 
          stderr,
        });
      });
    });
  }

  /**
   * Upload a file via SFTP
   */
  uploadFile(localPath, remotePath) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.client) {
        reject(new Error('SSH not connected'));
        return;
      }

      this.client.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }

        sftp.fastPut(localPath, remotePath, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve({ success: true, localPath, remotePath });
        });
      });
    });
  }

  /**
   * Download a file via SFTP
   */
  downloadFile(remotePath, localPath) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.client) {
        reject(new Error('SSH not connected'));
        return;
      }

      this.client.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }

        sftp.fastGet(remotePath, localPath, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve({ success: true, remotePath, localPath });
        });
      });
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw new Error('Max reconnection attempts reached');
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    console.log(`[SSH] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return this.connect();
  }

  /**
   * Send keep-alive to prevent connection timeout
   */
  sendKeepAlive() {
    if (this.client && this.isConnected) {
      this.client.emit('keepalive', 'keepalive');
    }
  }

  /**
   * Check if connection is active
   */
  isAlive() {
    return this.isConnected && this.client;
  }

  /**
   * Get connection info
   */
  getInfo() {
    return {
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      connected: this.isConnected,
      connecting: this.isConnecting,
    };
  }

  /**
   * Close the SSH connection
   */
  disconnect() {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.end();
        this.client = null;
      }
      this.isConnected = false;
      this.isConnecting = false;
      console.log(`[SSH] Disconnected from ${this.config.host}`);
      resolve(true);
    });
  }
}

module.exports = SSHConnection;
