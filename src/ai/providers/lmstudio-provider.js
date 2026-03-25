/**
 * LM Studio Provider - FREE Local AI (Alternative to Ollama)
 * https://lmstudio.ai
 */
const axios = require('axios');
const BaseProvider = require('./base-provider');

class LMStudioProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'lmstudio';
    this.baseURL = config.baseURL || process.env.LMSTUDIO_API_URL || 'http://localhost:1234/v1';
    this.apiKey = config.apiKey || process.env.LMSTUDIO_API_KEY || 'not-needed';
    this.model = config.model || 'local-model';
    this.initialized = false;
  }

  async initialize() {
    try {
      // Check if LM Studio is running
      const response = await axios.get(`${this.baseURL}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      }).catch(() => ({ data: { data: [] } }));
      console.log('[LM Studio] Available models:', response.data.data?.map(m => m.id) || []);
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('[LM Studio] Initialization failed:', error.message);
      this.initialized = false;
      return false;
    }
  }

  async query(prompt, options = {}) {
    try {
      const response = await axios.post(`${this.baseURL}/chat/completions`, {
        model: options.model || this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096,
        stream: false,
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        text: response.data.choices[0].message.content,
        model: response.data.model,
        usage: response.data.usage,
      };
    } catch (error) {
      throw new Error(`LM Studio query failed: ${error.message}`);
    }
  }

  async queryStream(prompt, onChunk, options = {}) {
    try {
      const response = await axios.post(`${this.baseURL}/chat/completions`, {
        model: options.model || this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096,
        stream: true,
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      });

      return new Promise((resolve, reject) => {
        let fullResponse = '';

        response.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n').filter(line => line.trim() && line.startsWith('data:'));
          for (const line of lines) {
            const data = line.replace('data: ', '');
            if (data === '[DONE]') {
              resolve({ success: true, text: fullResponse, done: true });
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullResponse += content;
                if (onChunk) onChunk(content);
              }
            } catch (e) {}
          }
        });

        response.data.on('error', reject);
        response.data.on('end', () => {
          resolve({ success: true, text: fullResponse, done: true });
        });
      });
    } catch (error) {
      throw new Error(`LM Studio stream failed: ${error.message}`);
    }
  }

  async isAvailable() {
    try {
      await axios.get(`${this.baseURL}/models`);
      return true;
    } catch {
      return false;
    }
  }

  async dispose() {
    this.initialized = false;
  }
}

module.exports = LMStudioProvider;
