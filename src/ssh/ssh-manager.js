const SSHConnection = require('./ssh-connection');

/**
 * SSH Manager - Connection Pool
 * Manages a pool of SSH connections with auto-reconnect and keep-alive
 */
class SSHManager {
  constructor(options = {}) {
    this.poolSize = options.poolSize || 3;
    this.keepAliveInterval = options.keepAliveInterval || 30000;
    this.reconnectDelay = options.reconnectDelay || 1000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    
    this.connections = [];
    this.availableConnections = [];
    this.isInitialized = false;
    this.keepAliveTimer = null;
    
    // SSH Configuration from environment or defaults
    this.config = {
      host: process.env.SSH_HOST || 'olimia',
      port: parseInt(process.env.SSH_PORT) || 22,
      username: process.env.SSH_USER || 'root',
      privateKey: this.loadPrivateKey(),
      readyTimeout: 20000,
      keepaliveInterval: 30000,
    };
  }

  /**
   * Load private key from file or environment
   */
  loadPrivateKey() {
    const envKey = process.env.SSH_PRIVATE_KEY;
    if (envKey) {
      return envKey;
    }
    
    const fs = require('fs');
    const keyPath = process.env.SSH_KEY_PATH || './ssh-key';
    
    try {
      if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath);
      }
    } catch (err) {
      console.log('[SSH] No SSH key file found, will use default');
    }
    
    // Default key from design doc: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBNnV/b/0GCSq2Eq6X7zNSqHMfCERYsxJ/Y7Wu/AzzIQ
    // The actual private key would need to be provided via environment
    return null;
  }

  /**
   * Initialize the connection pool
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('[SSH] Pool already initialized');
      return;
    }

    console.log(`[SSH] Initializing connection pool (size: ${this.poolSize})`);
    
    // Create all connections in the pool
    for (let i = 0; i < this.poolSize; i++) {
      const conn = new SSHConnection(this.config);
      conn.poolIndex = i;
      this.connections.push(conn);
      this.availableConnections.push(conn);
    }

    // Connect all connections
    const connectPromises = this.connections.map(conn => 
      conn.connect().catch(err => {
        console.error(`[SSH] Failed to connect pool member ${conn.poolIndex}: ${err.message}`);
        return false;
      })
    );

    await Promise.all(connectPromises);
    
    // Start keep-alive timer
    this.startKeepAlive();
    
    this.isInitialized = true;
    console.log('[SSH] Connection pool initialized');
  }

  /**
   * Start keep-alive to prevent timeout
   */
  startKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
    }

    this.keepAliveTimer = setInterval(() => {
      this.connections.forEach(conn => {
        if (conn.isConnected) {
          conn.sendKeepAlive();
        }
      });
    }, this.keepAliveInterval);
  }

  /**
   * Get an available connection from the pool
   */
  async getConnection() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Try to get an available connection
    while (this.availableConnections.length > 0) {
      const conn = this.availableConnections.pop();
      
      if (conn.isAlive()) {
        return conn;
      }
      
      // Connection is dead, try to reconnect
      try {
        await conn.connect();
        return conn;
      } catch (err) {
        console.error(`[SSH] Failed to reconnect: ${err.message}`);
        // Try next connection
      }
    }

    // All connections busy, create a new one or wait
    console.log('[SSH] All connections busy, creating temporary connection');
    const tempConn = new SSHConnection(this.config);
    await tempConn.connect();
    return tempConn;
  }

  /**
   * Return a connection to the pool
   */
  releaseConnection(conn) {
    if (this.connections.includes(conn) && conn.isAlive()) {
      this.availableConnections.push(conn);
    } else if (conn && !conn.isAlive()) {
      // Try to reconnect dead connection
      conn.reconnect().catch(err => {
        console.error(`[SSH] Failed to reconnect released connection: ${err.message}`);
      });
    }
  }

  /**
   * Execute a command using a pooled connection
   */
  async exec(command) {
    const conn = await this.getConnection();
    
    try {
      const result = await conn.exec(command);
      return result;
    } finally {
      this.releaseConnection(conn);
    }
  }

  /**
   * Execute a command with streaming response
   */
  async execStream(command, onData, onError) {
    const conn = await this.getConnection();
    
    try {
      const result = await conn.execStream(command, onData, onError);
      return result;
    } finally {
      this.releaseConnection(conn);
    }
  }

  /**
   * Query the remote AI model (Nemotron)
   */
  async query(prompt, options = {}) {
    const {
      model = 'nemotron',
      temperature = 0.7,
      maxTokens = 2048,
      stream = false,
    } = options;

    // Build the command to send to remote server
    // This assumes there's a script/endpoint on the remote server
    const cmd = this.buildQueryCommand(prompt, { model, temperature, maxTokens, stream });
    
    if (stream) {
      let fullResponse = '';
      await this.execStream(cmd, 
        (data) => { fullResponse += data; },
        (error) => { console.error('[SSH] Stream error:', error); }
      );
      return { response: fullResponse, stream: false };
    } else {
      const result = await this.exec(cmd);
      return { 
        response: result.stdout, 
        stderr: result.stderr,
        code: result.code 
      };
    }
  }

  /**
   * Build the query command for the remote AI model
   */
  buildQueryCommand(prompt, options) {
    // Escape prompt for shell
    const escapedPrompt = prompt.replace(/'/g, "'\\''");
    const escapedJson = JSON.stringify({
      prompt,
      ...options
    });
    
    // Command to execute remote AI query
    // This would call the remote AI service API
    return `echo '${escapedJson}' | python3 -c "import sys,json; print('AI_QUERY:' + json.dumps({'prompt': json.load(sys.stdin)['prompt'], 'options': ${escapedJson}}))"`;
  }

  /**
   * Disconnect all connections in the pool
   */
  async disconnect() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }

    const disconnectPromises = this.connections.map(conn => 
      conn.disconnect().catch(err => {
        console.error(`[SSH] Error disconnecting: ${err.message}`);
        return false;
      })
    );

    await Promise.all(disconnectPromises);
    
    this.connections = [];
    this.availableConnections = [];
    this.isInitialized = false;
    
    console.log('[SSH] All connections disconnected');
  }

  /**
   * Check pool health
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      poolSize: this.poolSize,
      activeConnections: this.connections.filter(c => c.isConnected).length,
      availableConnections: this.availableConnections.length,
    };
  }

  /**
   * Reconnect all dead connections
   */
  async healthCheck() {
    const healthPromises = this.connections.map(async (conn) => {
      if (!conn.isConnected) {
        try {
          await conn.connect();
          return true;
        } catch (err) {
          return false;
        }
      }
      return true;
    });

    const results = await Promise.all(healthPromises);
    const healthy = results.filter(r => r).length;
    
    console.log(`[SSH] Health check: ${healthy}/${this.poolSize} connections healthy`);
    return healthy > 0;
  }
}

// Export singleton instance
const sshManager = new SSHManager();

module.exports = {
  SSHManager,
  sshManager,
};