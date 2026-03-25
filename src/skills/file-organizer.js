const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const fs = require('fs').promises;
const path = require('path');

class FileOrganizer {
    constructor() {
        this.basePath = process.cwd();
    }

    async organizeFiles(options = {}) {
        const { sourceDir = '.', pattern = '*', destination, action = 'move' } = options;

        try {
            const files = await this.scanDirectory(sourceDir, pattern);

            if (action === 'move' && destination) {
                return await this.moveFiles(files, destination);
            } else if (action === 'rename') {
                return await this.renameFiles(files, options.renamePattern);
            } else if (action === 'sort') {
                return await this.sortIntoFolders(files, options.sortBy);
            }

            return { success: true, message: `Found ${files.length} files`, files };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async scanDirectory(dir, pattern = '*') {
        const files = [];
        const items = await fs.readdir(dir);

        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = await fs.stat(fullPath);

            if (stat.isFile()) {
                if (this.matchesPattern(item, pattern)) {
                    files.push({
                        name: item,
                        path: fullPath,
                        size: stat.size,
                        modified: stat.mtime,
                        extension: path.extname(item)
                    });
                }
            } else if (stat.isDirectory() && options.recursive) {
                // Recursive scanning if needed
                const subFiles = await this.scanDirectory(fullPath, pattern);
                files.push(...subFiles);
            }
        }

        return files;
    }

    matchesPattern(filename, pattern) {
        if (pattern === '*') return true;
        // Simple pattern matching - could be enhanced with glob
        return filename.includes(pattern.replace('*', ''));
    }

    async moveFiles(files, destination) {
        const results = [];

        for (const file of files) {
            const destPath = path.join(destination, path.basename(file.path));

            try {
                await fs.rename(file.path, destPath);
                results.push({ file: file.name, status: 'moved', destination: destPath });
            } catch (error) {
                results.push({ file: file.name, status: 'error', error: error.message });
            }
        }

        return { success: true, results };
    }

    async renameFiles(files, renamePattern) {
        // Implement intelligent renaming based on patterns
        const results = [];

        for (const file of files) {
            const newName = this.generateNewName(file.name, renamePattern);
            const newPath = path.join(path.dirname(file.path), newName);

            try {
                await fs.rename(file.path, newPath);
                results.push({ oldName: file.name, newName, status: 'renamed' });
            } catch (error) {
                results.push({ file: file.name, status: 'error', error: error.message });
            }
        }

        return { success: true, results };
    }

    generateNewName(currentName, pattern) {
        // Simple renaming logic - can be enhanced with AI
        if (pattern === 'lowercase') {
            return currentName.toLowerCase();
        } else if (pattern === 'uppercase') {
            return currentName.toUpperCase();
        } else if (pattern === 'remove_spaces') {
            return currentName.replace(/\s+/g, '_');
        }
        return currentName;
    }

    async sortIntoFolders(files, sortBy = 'extension') {
        const folders = {};

        // Group files by criteria
        for (const file of files) {
            let key;
            switch (sortBy) {
                case 'extension':
                    key = file.extension || 'no_extension';
                    break;
                case 'date':
                    key = file.modified.toISOString().split('T')[0]; // YYYY-MM-DD
                    break;
                case 'size':
                    key = file.size < 1024 * 1024 ? 'small' : 'large';
                    break;
                default:
                    key = 'misc';
            }

            if (!folders[key]) folders[key] = [];
            folders[key].push(file);
        }

        // Create folders and move files
        const results = [];
        for (const [folder, folderFiles] of Object.entries(folders)) {
            const folderPath = path.join(this.basePath, folder);

            try {
                await fs.mkdir(folderPath, { recursive: true });

                for (const file of folderFiles) {
                    const destPath = path.join(folderPath, path.basename(file.path));
                    await fs.rename(file.path, destPath);
                    results.push({ file: file.name, folder, status: 'sorted' });
                }
            } catch (error) {
                results.push({ folder, status: 'error', error: error.message });
            }
        }

        return { success: true, results };
    }

    async createBackup(sourceDir, backupDir) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(backupDir, `backup_${timestamp}`);

            await fs.mkdir(backupPath, { recursive: true });

            // Copy files (simplified - could use more robust copying)
            const files = await this.scanDirectory(sourceDir);
            let copied = 0;

            for (const file of files) {
                const destPath = path.join(backupPath, path.basename(file.path));
                await fs.copyFile(file.path, destPath);
                copied++;
            }

            return { success: true, backupPath, filesCopied: copied };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = FileOrganizer;