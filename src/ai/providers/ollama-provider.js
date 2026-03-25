/**
 * Ollama Provider - Connect to Ollama/Olimia local AI
 * FREE and runs locally - https://ollama.ai
 */
const axios = require('axios');
const BaseProvider = require('./base-provider');

class OllamaProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'ollama';
    this.baseURL = config.baseURL || process.env.OLLAMA_API_URL || 'http://localhost:11434';
    this.model = config.model || process.env.OLLAMA_MODEL || 'llama3.2';
    this.apiKey = config.apiKey || process.env.OLLAMA_API_KEY || '';
    this.initialized = false;
  }

  async initialize() {
    try {
      // Check if Ollama is running
      const response = await axios.get(`${this.baseURL}/api/tags`);
      console.log('[Ollama] Available models:', response.data.models.map(m => m.name));
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('[Ollama] Initialization failed:', error.message);
      // Don't throw - allow fallback to other providers
      this.initialized = false;
      return false;
    }
  }

  async query(prompt, options = {}) {
    try {
      const response = await axios.post(`${this.baseURL}/api/generate`, {
        model: options.model || this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || 4096,
        }
      }, {
        headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}
      });

      return {
        success: true,
        text: response.data.response,
        model: response.data.model,
        done: response.data.done,
        context: response.data.context,
        totalDuration: response.data.total_duration,
      };
    } catch (error) {
      throw new Error(`Ollama query failed: ${error.message}`);
    }
  }

  async queryStream(prompt, onChunk, options = {}) {
    try {
      const response = await axios.post(`${this.baseURL}/api/generate`, {
        model: options.model || this.model,
        prompt: prompt,
        stream: true,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || 4096,
        }
      }, {
        headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {},
        responseType: 'stream'
      });

      return new Promise((resolve, reject) => {
        let fullResponse = '';

        response.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n').filter(line => line.trim());
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              fullResponse += data.response;
              if (onChunk) onChunk(data.response);
              if (data.done) {
                resolve({
                  success: true,
                  text: fullResponse,
                  done: true
                });
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        });

        response.data.on('error', reject);
        response.data.on('end', () => {
          if (fullResponse) {
            resolve({
              success: true,
              text: fullResponse,
              done: true
            });
          }
        });
      });
    } catch (error) {
      throw new Error(`Ollama stream failed: ${error.message}`);
    }
  }

  async isAvailable() {
    try {
      await axios.get(`${this.baseURL}/api/tags`);
      return true;
    } catch {
      return false;
    }
  }

  async getModels() {
    try {
      const response = await axios.get(`${this.baseURL}/api/tags`);
      return response.data.models || [];
    } catch (error) {
      return [];
    }
  }

  async dispose() {
    this.initialized = false;
    console.log('[Ollama] Disposed');
  }
}

module.exports = OllamaProvider;
