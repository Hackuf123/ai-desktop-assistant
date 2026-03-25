const OpenAI = require('openai');

class TextProcessor {
    constructor(openaiApiKey = null) {
        const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
        this.openai = apiKey ? new OpenAI({ apiKey }) : null;
    }

    async processText(text, action, options = {}) {
        switch (action) {
            case 'summarize':
                return await this.summarizeText(text, options);
            case 'translate':
                return await this.translateText(text, options);
            case 'format':
                return this.formatText(text, options);
            case 'extract':
                return this.extractInformation(text, options);
            case 'rewrite':
                return await this.rewriteText(text, options);
            case 'analyze':
                return this.analyzeText(text, options);
            default:
                return { success: false, error: 'Unknown action' };
        }
    }

    async summarizeText(text, options = {}) {
        const { maxLength = 100, style = 'concise' } = options;

        if (this.openai) {
            try {
                const response = await this.openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    messages: [{
                        role: 'user',
                        content: `Summarize the following text in a ${style} style, keeping it under ${maxLength} words:\n\n${text}`
                    }],
                    max_tokens: 200
                });

                return {
                    success: true,
                    action: 'summarize',
                    result: response.choices[0].message.content.trim(),
                    method: 'ai'
                };
            } catch (error) {
                return { success: false, error: error.message };
            }
        } else {
            // Fallback to simple summarization
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
            const summary = sentences.slice(0, 3).join('. ').substring(0, maxLength);

            return {
                success: true,
                action: 'summarize',
                result: summary + (summary.length < text.length ? '...' : ''),
                method: 'basic'
            };
        }
    }

    async translateText(text, options = {}) {
        const { targetLanguage = 'Spanish', sourceLanguage = 'auto' } = options;

        if (this.openai) {
            try {
                const response = await this.openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    messages: [{
                        role: 'user',
                        content: `Translate the following text to ${targetLanguage}${sourceLanguage !== 'auto' ? ` from ${sourceLanguage}` : ''}:\n\n${text}`
                    }],
                    max_tokens: 500
                });

                return {
                    success: true,
                    action: 'translate',
                    result: response.choices[0].message.content.trim(),
                    from: sourceLanguage,
                    to: targetLanguage,
                    method: 'ai'
                };
            } catch (error) {
                return { success: false, error: error.message };
            }
        } else {
            return {
                success: false,
                error: 'Translation requires OpenAI API key',
                suggestion: 'Configure OpenAI API for advanced translation features'
            };
        }
    }

    formatText(text, options = {}) {
        const { format = 'markdown', style = 'standard' } = options;

        let result = text;

        switch (format) {
            case 'markdown':
                // Basic markdown formatting
                result = result.replace(/^### (.*$)/gim, '### $1'); // Headers
                result = result.replace(/\*\*(.*?)\*\*/g, '**$1**'); // Bold
                result = result.replace(/\*(.*?)\*/g, '*$1*'); // Italic
                result = result.replace(/^- /gm, '- '); // Lists
                break;

            case 'html':
                // Basic HTML formatting
                result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                result = result.replace(/\*(.*?)\*/g, '<em>$1</em>');
                result = result.replace(/\n\n/g, '</p><p>');
                result = `<p>${result}</p>`;
                break;

            case 'json':
                // Convert to JSON structure
                const lines = result.split('\n').filter(line => line.trim());
                result = JSON.stringify({
                    content: result,
                    lines: lines.length,
                    words: result.split(/\s+/).length,
                    characters: result.length
                }, null, 2);
                break;
        }

        return {
            success: true,
            action: 'format',
            result,
            format,
            style
        };
    }

    extractInformation(text, options = {}) {
        const { type = 'entities' } = options;

        let result = {};

        switch (type) {
            case 'entities':
                // Extract basic entities
                const emails = text.match(/[\w.-]+@[\w.-]+\.\w+/g) || [];
                const urls = text.match(/https?:\/\/[^\s]+/g) || [];
                const phoneNumbers = text.match(/\+?[\d\s\-\(\)]{10,}/g) || [];
                const dates = text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g) || [];

                result = {
                    emails: [...new Set(emails)],
                    urls: [...new Set(urls)],
                    phoneNumbers: [...new Set(phoneNumbers)],
                    dates: [...new Set(dates)]
                };
                break;

            case 'keywords':
                // Extract keywords (simple frequency-based)
                const words = text.toLowerCase()
                    .replace(/[^\w\s]/g, '')
                    .split(/\s+/)
                    .filter(word => word.length > 3);

                const frequency = {};
                words.forEach(word => {
                    frequency[word] = (frequency[word] || 0) + 1;
                });

                const keywords = Object.entries(frequency)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 10)
                    .map(([word, count]) => ({ word, count }));

                result = { keywords };
                break;

            case 'sentiment':
                // Basic sentiment analysis
                const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic'];
                const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'worst', 'hate'];

                const lowerText = text.toLowerCase();
                const positiveCount = positiveWords.reduce((count, word) =>
                    count + (lowerText.split(word).length - 1), 0);
                const negativeCount = negativeWords.reduce((count, word) =>
                    count + (lowerText.split(word).length - 1), 0);

                let sentiment = 'neutral';
                if (positiveCount > negativeCount) sentiment = 'positive';
                else if (negativeCount > positiveCount) sentiment = 'negative';

                result = {
                    sentiment,
                    positiveScore: positiveCount,
                    negativeScore: negativeCount
                };
                break;
        }

        return {
            success: true,
            action: 'extract',
            type,
            result
        };
    }

    async rewriteText(text, options = {}) {
        const { style = 'professional', tone = 'neutral' } = options;

        if (this.openai) {
            try {
                const response = await this.openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    messages: [{
                        role: 'user',
                        content: `Rewrite the following text in a ${style} style with a ${tone} tone:\n\n${text}`
                    }],
                    max_tokens: 500
                });

                return {
                    success: true,
                    action: 'rewrite',
                    result: response.choices[0].message.content.trim(),
                    style,
                    tone,
                    method: 'ai'
                };
            } catch (error) {
                return { success: false, error: error.message };
            }
        } else {
            return {
                success: false,
                error: 'Text rewriting requires OpenAI API key',
                suggestion: 'Configure OpenAI API for advanced text processing'
            };
        }
    }

    analyzeText(text, options = {}) {
        const analysis = {
            characters: text.length,
            words: text.split(/\s+/).filter(word => word.length > 0).length,
            sentences: text.split(/[.!?]+/).filter(sent => sent.trim().length > 0).length,
            paragraphs: text.split(/\n\s*\n/).filter(para => para.trim().length > 0).length,
            lines: text.split('\n').length,
            averageWordLength: 0,
            readabilityScore: 0
        };

        // Calculate average word length
        const words = text.split(/\s+/).filter(word => word.length > 0);
        if (words.length > 0) {
            analysis.averageWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
        }

        // Simple readability score (approximate)
        const sentences = text.split(/[.!?]+/).filter(sent => sent.trim().length > 0);
        if (sentences.length > 0) {
            const avgWordsPerSentence = words.length / sentences.length;
            analysis.readabilityScore = Math.max(0, 100 - avgWordsPerSentence);
        }

        return {
            success: true,
            action: 'analyze',
            result: analysis
        };
    }
}

module.exports = TextProcessor;