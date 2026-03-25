const axios = require('axios');
const cheerio = require('cheerio');

class WebAutomator {
    constructor() {
        this.session = axios.create({
            timeout: 10000,
            headers: {
                'User-Agent': 'AI-Desktop-Assistant/1.0'
            }
        });
    }

    async searchWeb(query, options = {}) {
        const { engine = 'google', maxResults = 5 } = options;

        try {
            let searchUrl;

            if (engine === 'google') {
                searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${maxResults}`;
            } else if (engine === 'duckduckgo') {
                searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            } else if (engine === 'bing') {
                searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
            }

            const response = await this.session.get(searchUrl);
            const results = this.parseSearchResults(response.data, engine);

            return {
                success: true,
                query,
                engine,
                results: results.slice(0, maxResults)
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    parseSearchResults(html, engine) {
        const $ = cheerio.load(html);
        const results = [];

        if (engine === 'google') {
            $('div.g').each((i, element) => {
                const title = $(element).find('h3').text().trim();
                const url = $(element).find('a').attr('href');
                const snippet = $(element).find('span').text().trim() ||
                               $(element).find('div[data-ved]').text().trim();

                if (title && url) {
                    results.push({
                        title,
                        url: url.startsWith('/url?q=') ? url.split('/url?q=')[1].split('&')[0] : url,
                        snippet: snippet.substring(0, 200)
                    });
                }
            });
        } else if (engine === 'duckduckgo') {
            $('.result').each((i, element) => {
                const title = $(element).find('.result__title').text().trim();
                const url = $(element).find('.result__url').attr('href');
                const snippet = $(element).find('.result__snippet').text().trim();

                if (title && url) {
                    results.push({ title, url, snippet });
                }
            });
        }

        return results;
    }

    async scrapeWebpage(url, options = {}) {
        const { selectors = {}, includeText = true, includeImages = false } = options;

        try {
            const response = await this.session.get(url);
            const $ = cheerio.load(response.data);

            const result = {
                url,
                title: $('title').text().trim(),
                scrapedAt: new Date().toISOString()
            };

            if (includeText) {
                result.text = $('body').text().trim().replace(/\s+/g, ' ').substring(0, 10000);
            }

            if (selectors) {
                result.extracted = {};
                for (const [key, selector] of Object.entries(selectors)) {
                    const elements = $(selector);
                    if (elements.length === 1) {
                        result.extracted[key] = elements.text().trim();
                    } else if (elements.length > 1) {
                        result.extracted[key] = elements.map((i, el) => $(el).text().trim()).get();
                    }
                }
            }

            if (includeImages) {
                result.images = $('img').map((i, el) => ({
                    src: $(el).attr('src'),
                    alt: $(el).attr('alt') || '',
                    title: $(el).attr('title') || ''
                })).get();
            }

            return { success: true, data: result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async downloadFile(url, destination, options = {}) {
        try {
            const response = await this.session.get(url, {
                responseType: 'stream',
                ...options
            });

            const fs = require('fs');
            const path = require('path');

            const filename = options.filename || path.basename(url);
            const filepath = path.join(destination, filename);

            const writer = fs.createWriteStream(filepath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    resolve({
                        success: true,
                        url,
                        filepath,
                        size: response.headers['content-length'],
                        contentType: response.headers['content-type']
                    });
                });
                writer.on('error', reject);
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async checkUrlStatus(url) {
        try {
            const response = await this.session.head(url);
            return {
                success: true,
                url,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                accessible: response.status >= 200 && response.status < 400
            };
        } catch (error) {
            return {
                success: false,
                url,
                error: error.message,
                accessible: false
            };
        }
    }

    async getWeather(location) {
        try {
            // Using a free weather API (example - you might want to use a proper API)
            const response = await this.session.get(`https://wttr.in/${encodeURIComponent(location)}?format=j1`);

            if (response.data) {
                const weather = response.data.current_condition[0];
                return {
                    success: true,
                    location,
                    temperature: weather.temp_C,
                    condition: weather.weatherDesc[0].value,
                    humidity: weather.humidity,
                    windSpeed: weather.windspeedKmph
                };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getNews(category = 'general', options = {}) {
        const { source = 'newsapi', apiKey } = options;

        if (!apiKey) {
            return { success: false, error: 'API key required for news' };
        }

        try {
            let url;
            if (source === 'newsapi') {
                url = `https://newsapi.org/v2/top-headlines?category=${category}&apiKey=${apiKey}`;
            }

            const response = await this.session.get(url);
            const articles = response.data.articles.slice(0, 5).map(article => ({
                title: article.title,
                description: article.description,
                url: article.url,
                source: article.source.name,
                publishedAt: article.publishedAt
            }));

            return {
                success: true,
                category,
                articles
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async monitorWebsite(url, options = {}) {
        const { interval = 300000, notifyCallback } = options; // 5 minutes default

        const monitor = async () => {
            const status = await this.checkUrlStatus(url);

            if (notifyCallback) {
                notifyCallback(status);
            }

            if (!status.accessible) {
                console.warn(`Website ${url} is not accessible: ${status.error}`);
            }
        };

        // Initial check
        await monitor();

        // Set up periodic monitoring
        const intervalId = setInterval(monitor, interval);

        return {
            success: true,
            url,
            interval,
            monitorId: intervalId,
            stop: () => clearInterval(intervalId)
        };
    }
}

module.exports = WebAutomator;