/**
 * AI Provider Manager
 * Manages multiple AI providers with automatic fallback
 */
const OllamaProvider = require('./ollama-provider');
const GroqProvider = require('./groq-provider');
const LMStudioProvider = require('./lmstudio-provider');

class AIManager {
  constructor() {
    this.providers = {};
    this.activeProvider = null;
    this.fallbackProvider = null;
    this.defaultProvider = process.env.DEFAULT_AI_PROVIDER || 'ollama';
  }

  /**
   * Initialize all available providers
   */
  async initialize() {
    console.log('[AI Manager] Initializing AI providers...');

    // Initialize Ollama (Olimia) - FREE local AI
    const ollama = new OllamaProvider();
    try {
      await ollama.initialize();
      if (ollama.initialized) {
        this.providers.ollama = ollama;
        console.log('[AI Manager] ✓ Ollama provider initialized');
      }
    } catch (e) {
      console.log('[AI Manager] ✗ Ollama not available');
    }

    // Initialize Groq - FREE high-speed inference
    const groq = new GroqProvider();
    try {
      await groq.initialize();
      if (groq.initialized) {
        this.providers.groq = groq;
        console.log('[AI Manager] ✓ Groq provider initialized');
      }
    } catch (e) {
      console.log('[AI Manager] ✗ Groq not available');
    }

    // Initialize LM Studio - FREE local AI alternative
    const lmstudio = new LMStudioProvider();
    try {
      await lmstudio.initialize();
      if (lmstudio.initialized) {
        this.providers.lmstudio = lmstudio;
        console.log('[AI Manager] ✓ LM Studio provider initialized');
      }
    } catch (e) {
      console.log('[AI Manager] ✗ LM Studio not available');
    }

    // Set active provider
    this.activeProvider = this.providers[this.defaultProvider] || 
                         Object.values(this.providers)[0] || 
                         null;

    if (this.activeProvider) {
      console.log(`[AI Manager] Active provider: ${this.activeProvider.name}`);
    } else {
      console.warn('[AI Manager] No AI providers available!');
    }
  }

  /**
   * Send a query to the AI
   * @param {string} prompt - The input prompt
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - The AI response
   */
  async query(prompt, options = {}) {
    if (!this.activeProvider) {
      throw new Error('No AI provider available');
    }

    try {
      return await this.activeProvider.query(prompt, options);
    } catch (error) {
      console.error(`[AI Manager] Query failed with ${this.activeProvider.name}:`, error.message);
      
      // Try fallback providers
      for (const name of ['ollama', 'groq', 'lmstudio']) {
        if (this.providers[name] && this.providers[name] !== this.activeProvider) {
          try {
            console.log(`[AI Manager] Trying fallback: ${name}`);
            this.activeProvider = this.providers[name];
            return await this.activeProvider.query(prompt, options);
          } catch (e) {
            console.error(`[AI Manager] Fallback ${name} failed:`, e.message);
          }
        }
      }
      
      throw new Error('All AI providers failed');
    }
  }

  /**
   * Send a query with streaming
   */
  async queryStream(prompt, onChunk, options = {}) {
    if (!this.activeProvider) {
      throw new Error('No AI provider available');
    }

    try {
      return await this.activeProvider.queryStream(prompt, onChunk, options);
    } catch (error) {
      console.error(`[AI Manager] Stream failed:`, error.message);
      throw error;
    }
  }

  /**
   * Switch to a specific provider
   */
  async switchProvider(providerName) {
    if (this.providers[providerName]) {
      this.activeProvider = this.providers[providerName];
      console.log(`[AI Manager] Switched to: ${providerName}`);
      return true;
    }
    console.warn(`[AI Manager] Provider ${providerName} not available`);
    return false;
  }

  /**
   * Get available providers
   */
  getProviders() {
    return Object.keys(this.providers);
  }

  /**
   * Get current provider status
   */
  getStatus() {
    return {
      active: this.activeProvider?.name || 'none',
      available: this.getProviders(),
    };
  }

  /**
   * Dispose all providers
   */
  async dispose() {
    for (const provider of Object.values(this.providers)) {
      await provider.dispose();
    }
  }
}

// Export singleton instance
module.exports = new AIManager();
