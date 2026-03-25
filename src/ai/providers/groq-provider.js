/**
 * Groq Provider - FREE High-Speed Inference
 * https://console.groq.com/keys
 */
const axios = require('axios');
const BaseProvider = require('./base-provider');

class GroqProvider extends BaseProvider {
  constructor(config = {}) {
    super(config);
    this.name = 'groq';
    this.baseURL = 'https://api.groq.com/openai/v1';
    this.apiKey = config.apiKey || process.env.GROQ_API_KEY || '';
    this.model = config.model || 'llama-3.1-70b-versatile';
    this.initialized = false;
  }

  async initialize() {
    if (!this.apiKey) {
      console.warn('[Groq] API key not set');
      this.initialized = false;
      return false;
    }
    this.initialized = true;
    return true;
  }

  async query(prompt, options = {}) {
    if (!this.initialized) {
      throw new Error('Groq provider not initialized - missing API key');
    }

    try {
      const response = await axios.post(`${this.baseURL}/chat/completions`, {
        model: options.model || this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096,
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
      throw new Error(`Groq query failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async queryStream(prompt, onChunk, options = {}) {
    if (!this.initialized) {
      throw new Error('Groq provider not initialized - missing API key');
    }

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
      throw new Error(`Groq stream failed: ${error.message}`);
    }
  }

  async isAvailable() {
    return this.initialized && !!this.apiKey;
  }

  async dispose() {
    this.initialized = false;
  }
}

module.exports = GroqProvider;
