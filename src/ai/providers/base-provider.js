/**
 * Base Provider - Abstract Interface for LLM Providers
 * All AI providers must implement this interface
 */
class BaseProvider {
  constructor(config = {}) {
    this.config = config;
    this.name = 'base-provider';
  }

  /**
   * Initialize the provider
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Send a query to the AI model
   * @param {string} prompt - The input prompt
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - The AI response
   */
  async query(prompt, options = {}) {
    throw new Error('query() must be implemented by subclass');
  }

  /**
   * Send a query with streaming response
   * @param {string} prompt - The input prompt
   * @param {Function} onChunk - Callback for each chunk
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - The AI response
   */
  async queryStream(prompt, onChunk, options = {}) {
    throw new Error('queryStream() must be implemented by subclass');
  }

  /**
   * Check if the provider is available
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error('isAvailable() must be implemented by subclass');
  }

  /**
   * Get provider status
   * @returns {Object}
   */
  getStatus() {
    return {
      name: this.name,
      initialized: this.initialized || false,
    };
  }

  /**
   * Clean up resources
   */
  async dispose() {
    throw new Error('dispose() must be implemented by subclass');
  }
}

module.exports = BaseProvider;