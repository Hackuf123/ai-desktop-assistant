/**
 * Web Browser Skill - Search and Browse the Web
 * Uses DuckDuckGo (free, no API key needed)
 * Supports web scraping with Cheerio
 */
const axios = require('axios');
const cheerio = require('cheerio');

class WebBrowser {
  constructor() {
    this.name = 'web-browser';
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.history = [];
  }

  /**
   * Search the web using DuckDuckGo (free, no API key)
   * @param {string} query - Search query
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} - Search results
   */
  async search(query, limit = 10) {
    try {
      // Use DuckDuckGo HTML search
      const response = await axios.get('https://html.duckduckgo.com/html/', {
        params: { q: query },
        headers: { 'User-Agent': this.userAgent },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);
      const results = [];

      $('.result').each((i, element) => {
        if (i >= limit) return;

        const title = $(element).find('.result__title').text().trim();
        const url = $(element).find('.result__url').attr('href');
        const snippet = $(element).find('.result__snippet').text().trim();

        if (title && url) {
          results.push({
            title,
            url: url.startsWith('http') ? url : 'https://' + url,
            snippet,
          });
        }
      });

      this._addToHistory({ query, results: results.length });
      return results;
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Fetch a web page
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - Page content
   */
  async fetch(url, options = {}) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          ...options.headers,
        },
        timeout: options.timeout || 30000,
        maxRedirects: options.maxRedirects || 5,
      });

      const $ = cheerio.load(response.data);
      
      // Remove scripts and styles
      $('script, style, nav, footer, header').remove();

      // Extract title
      const title = $('title').text() || $('h1').first().text() || 'Untitled';

      // Extract main content
      let content = '';
      if (options.selector) {
        content = $(options.selector).text();
      } else {
        // Try common content selectors
        content = $('article, main, .content, #content, .post, .article').text() || $('body').text();
      }

      // Clean up content
      content = content.replace(/\s+/g, ' ').trim().substring(0, options.maxLength || 10000);

      // Extract links
      const links = [];
      $('a[href]').each((i, el) => {
        if (links.length >= 20) return;
        const href = $(el).attr('href');
        if (href && (href.startsWith('http') || href.startsWith('/'))) {
          links.push({
            text: $(el).text().trim().substring(0, 50),
            href: href.startsWith('http') ? href : new URL(href, url).href,
          });
        }
      });

      this._addToHistory({ url, type: 'fetch' });

      return {
        success: true,
        url,
        title: title.trim(),
        content,
        links,
        status: response.status,
        headers: response.headers,
      };
    } catch (error) {
      throw new Error(`Fetch failed: ${error.message}`);
    }
  }

  /**
   * Extract data from a page using CSS selector
   * @param {string} url - URL to scrape
   * @param {string} selector - CSS selector
   * @returns {Promise<Object>} - Extracted data
   */
  async extract(url, selector) {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      const elements = [];

      $(selector).each((i, el) => {
        const text = $(el).text().trim();
        const html = $.html(el);
        const attributes = {};
        
        // Get common attributes
        for (const attr of ['href', 'src', 'alt', 'title', 'id', 'class']) {
          const value = $(el).attr(attr);
          if (value) attributes[attr] = value;
        }

        elements.push({ text, html, attributes });
      });

      return {
        success: true,
        url,
        selector,
        count: elements.length,
        elements,
      };
    } catch (error) {
      throw new Error(`Extract failed: ${error.message}`);
    }
  }

  /**
   * Get page metadata
   * @param {string} url - URL to analyze
   * @returns {Promise<Object>} - Metadata
   */
  async getMetadata(url) {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);

      // Extract meta tags
      const metadata = {
        title: $('title').text() || $('meta[property="og:title"]').attr('content'),
        description: $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content'),
        keywords: $('meta[name="keywords"]').attr('content'),
        author: $('meta[name="author"]').attr('content'),
        ogImage: $('meta[property="og:image"]').attr('content'),
        canonical: $('link[rel="canonical"]').attr('href'),
        viewport: $('meta[name="viewport"]').attr('content'),
      };

      // Clean up
      for (const key in metadata) {
        if (metadata[key]) metadata[key] = metadata[key].trim();
      }

      return {
        success: true,
        url,
        status: response.status,
        metadata,
      };
    } catch (error) {
      throw new Error(`Metadata fetch failed: ${error.message}`);
    }
  }

  /**
   * Download file from URL
   * @param {string} url - URL to download
   * @param {string} destPath - Destination path
   * @returns {Promise<Object>} - Download result
   */
  async download(url, destPath) {
    const fs = require('fs');
    const path = require('path');

    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        responseType: 'stream',
        timeout: 60000,
      });

      const writer = fs.createWriteStream(destPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          const stats = fs.statSync(destPath);
          resolve({
            success: true,
            url,
            path: destPath,
            size: stats.size,
          });
        });
        writer.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  /**
   * Check if URL is accessible
   * @param {string} url - URL to check
   * @returns {Promise<Object>} - URL status
   */
  async check(url) {
    try {
      const response = await axios.head(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 10000,
      });

      return {
        accessible: true,
        url,
        status: response.status,
        contentType: response.headers['content-type'],
        contentLength: response.headers['content-length'],
      };
    } catch (error) {
      return {
        accessible: false,
        url,
        error: error.message,
      };
    }
  }

  /**
   * Add to history
   */
  _addToHistory(entry) {
    this.history.push({
      ...entry,
      timestamp: new Date().toISOString(),
    });
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }
  }

  /**
   * Get search history
   */
  getHistory() {
    return this.history;
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.history = [];
  }
}

module.exports = new WebBrowser();
