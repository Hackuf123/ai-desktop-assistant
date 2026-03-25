/**
 * File Manager Skill - Advanced File Operations
 * Provides comprehensive file management capabilities
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class FileManager {
  constructor() {
    this.name = 'file-manager';
    this.allowedExtensions = (process.env.ALLOWED_EXTENSIONS || '.js,.py,.txt,.json,.md,.html,.css,.xml,.csv,.log').split(',');
    this.maxFileSize = (process.env.MAX_FILE_SIZE_MB || 50) * 1024 * 1024;
    this.history = [];
  }

  /**
   * Read a file
   * @param {string} filePath - Path to file
   * @param {Object} options - Read options
   * @returns {Promise<Object>} - File content
   */
  async readFile(filePath, options = {}) {
    const resolvedPath = path.resolve(filePath);
    
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(resolvedPath);
    if (stats.isDirectory()) {
      throw new Error(`Path is a directory: ${filePath}`);
    }

    if (stats.size > this.maxFileSize) {
      throw new Error(`File too large: ${stats.size} bytes (max: ${this.maxFileSize})`);
    }

    const encoding = options.encoding || 'utf8';
    const content = fs.readFileSync(resolvedPath, encoding);

    return {
      success: true,
      path: resolvedPath,
      name: path.basename(resolvedPath),
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      content: content.substring(0, options.maxLength || content.length),
      encoding,
    };
  }

  /**
   * Write content to a file
   * @param {string} filePath - Path to file
   * @param {string} content - Content to write
   * @param {Object} options - Write options
   * @returns {Promise<Object>} - Write result
   */
  async writeFile(filePath, content, options = {}) {
    const resolvedPath = path.resolve(filePath);
    const dir = path.dirname(resolvedPath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const encoding = options.encoding || 'utf8';
    fs.writeFileSync(resolvedPath, content, encoding);

    const stats = fs.statSync(resolvedPath);

    return {
      success: true,
      path: resolvedPath,
      name: path.basename(resolvedPath),
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
    };
  }

  /**
   * Append content to a file
   * @param {string} filePath - Path to file
   * @param {string} content - Content to append
   * @returns {Promise<Object>} - Write result
   */
  async appendFile(filePath, content) {
    const resolvedPath = path.resolve(filePath);
    
    if (!fs.existsSync(resolvedPath)) {
      return this.writeFile(resolvedPath, content);
    }

    fs.appendFileSync(resolvedPath, content);
    const stats = fs.statSync(resolvedPath);

    return {
      success: true,
      path: resolvedPath,
      size: stats.size,
    };
  }

  /**
   * Delete a file or directory
   * @param {string} targetPath - Path to delete
   * @param {Object} options - Delete options
   * @returns {Promise<Object>} - Delete result
   */
  async delete(targetPath, options = {}) {
    const resolvedPath = path.resolve(targetPath);
    
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Path not found: ${targetPath}`);
    }

    const stats = fs.statSync(resolvedPath);
    
    if (stats.isDirectory()) {
      if (options.recursive) {
        fs.rmSync(resolvedPath, { recursive: true, force: true });
      } else {
        fs.rmdirSync(resolvedPath);
      }
    } else {
      fs.unlinkSync(resolvedPath);
    }

    return {
      success: true,
      path: resolvedPath,
      type: stats.isDirectory() ? 'directory' : 'file',
    };
  }

  /**
   * Copy a file or directory
   * @param {string} sourcePath - Source path
   * @param {string} destPath - Destination path
   * @returns {Promise<Object>} - Copy result
   */
  async copy(sourcePath, destPath) {
    const src = path.resolve(sourcePath);
    const dest = path.resolve(destPath);

    if (!fs.existsSync(src)) {
      throw new Error(`Source not found: ${sourcePath}`);
    }

    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const stats = fs.statSync(src);
    
    if (stats.isDirectory()) {
      this._copyDirectory(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }

    return {
      success: true,
      source: src,
      destination: dest,
    };
  }

  /**
   * Move a file or directory
   * @param {string} sourcePath - Source path
   * @param {string} destPath - Destination path
   * @returns {Promise<Object>} - Move result
   */
  async move(sourcePath, destPath) {
    const result = await this.copy(sourcePath, destPath);
    await this.delete(sourcePath);
    
    return {
      ...result,
      success: true,
    };
  }

  /**
   * List directory contents
   * @param {string} dirPath - Directory path
   * @param {Object} options - List options
   * @returns {Promise<Object>} - Directory listing
   */
  async list(dirPath, options = {}) {
    const resolvedPath = path.resolve(dirPath);
    
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${dirPath}`);
    }

    const items = fs.readdirSync(resolvedPath);
    const result = [];

    for (const item of items) {
      try {
        const itemPath = path.join(resolvedPath, item);
        const itemStats = fs.statSync(itemPath);
        
        result.push({
          name: item,
          path: itemPath,
          type: itemStats.isDirectory() ? 'directory' : 'file',
          size: itemStats.size,
          created: itemStats.birthtime,
          modified: itemStats.mtime,
        });
      } catch (e) {
        // Skip inaccessible files
      }
    }

    // Sort by type and name
    result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return {
      success: true,
      path: resolvedPath,
      count: result.length,
      items: options.detailed ? result : result.map(i => i.name),
    };
  }

  /**
   * Create a directory
   * @param {string} dirPath - Directory path
   * @param {Object} options - Create options
   * @returns {Promise<Object>} - Create result
   */
  async createDirectory(dirPath, options = {}) {
    const resolvedPath = path.resolve(dirPath);
    
    if (fs.existsSync(resolvedPath)) {
      if (!options.force) {
        throw new Error(`Directory already exists: ${dirPath}`);
      }
    } else {
      fs.mkdirSync(resolvedPath, { recursive: true });
    }

    return {
      success: true,
      path: resolvedPath,
    };
  }

  /**
   * Get file/directory info
   * @param {string} targetPath - Path to inspect
   * @returns {Promise<Object>} - File info
   */
  async info(targetPath) {
    const resolvedPath = path.resolve(targetPath);
    
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Path not found: ${targetPath}`);
    }

    const stats = fs.statSync(resolvedPath);

    return {
      success: true,
      path: resolvedPath,
      name: path.basename(resolvedPath),
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
      isReadOnly: !(stats.mode & 0o200),
    };
  }

  /**
   * Search for files
   * @param {string} dirPath - Directory to search
   * @param {string} pattern - Search pattern
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Matching files
   */
  async search(dirPath, pattern, options = {}) {
    const resolvedPath = path.resolve(dirPath);
    const results = [];
    const regex = new RegExp(pattern, options.caseSensitive ? '' : 'i');

    const searchRecursive = async (dir) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const itemPath = path.join(dir, item);
        
        try {
          const stats = fs.statSync(itemPath);
          
          if (stats.isDirectory()) {
            if (!options.excludeDirs?.includes(item)) {
              await searchRecursive(itemPath);
            }
          } else if (regex.test(item)) {
            results.push({
              name: item,
              path: itemPath,
              size: stats.size,
              modified: stats.mtime,
            });
          }
        } catch (e) {
          // Skip inaccessible files
        }
      }
    };

    await searchRecursive(resolvedPath);

    return results;
  }

  /**
   * Get file checksum
   * @param {string} filePath - Path to file
   * @param {string} algorithm - Hash algorithm
   * @returns {Promise<Object>} - Checksum result
   */
  async checksum(filePath, algorithm = 'sha256') {
    const content = fs.readFileSync(filePath);
    const hash = crypto.createHash(algorithm).update(content).digest('hex');
    
    return {
      path: filePath,
      algorithm,
      checksum: hash,
    };
  }

  /**
   * Helper: Copy directory recursively
   */
  _copyDirectory(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const items = fs.readdirSync(src);
    
    for (const item of items) {
      const srcItem = path.join(src, item);
      const destItem = path.join(dest, item);
      const stats = fs.statSync(srcItem);
      
      if (stats.isDirectory()) {
        this._copyDirectory(srcItem, destItem);
      } else {
        fs.copyFileSync(srcItem, destItem);
      }
    }
  }
}

module.exports = new FileManager();
