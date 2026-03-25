const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class PackageManager {
    constructor() {
        this.packageManagers = {
            npm: this.npmInstall.bind(this),
            yarn: this.yarnInstall.bind(this),
            pip: this.pipInstall.bind(this),
            apt: this.aptInstall.bind(this),
            brew: this.brewInstall.bind(this)
        };
    }

    async installPackages(packages, manager = 'auto') {
        if (!Array.isArray(packages)) {
            packages = [packages];
        }

        if (manager === 'auto') {
            // Auto-detect based on project files
            manager = await this.detectPackageManager();
        }

        const installFunction = this.packageManagers[manager];
        if (!installFunction) {
            return { error: `Unsupported package manager: ${manager}` };
        }

        try {
            const results = [];
            for (const pkg of packages) {
                const result = await installFunction(pkg);
                results.push(result);
            }
            return { success: true, results };
        } catch (error) {
            return { error: error.message };
        }
    }

    async detectPackageManager() {
        // Check for lock files or config files
        const fs = require('fs').promises;
        const path = require('path');

        try {
            const files = await fs.readdir(process.cwd());
            if (files.includes('yarn.lock')) return 'yarn';
            if (files.includes('package-lock.json')) return 'npm';
            if (files.includes('requirements.txt')) return 'pip';
            return 'npm'; // default
        } catch (error) {
            return 'npm';
        }
    }

    async npmInstall(packageName) {
        try {
            const { stdout, stderr } = await execAsync(`npm install ${packageName}`);
            return {
                success: true,
                package: packageName,
                manager: 'npm',
                output: stdout,
                errors: stderr
            };
        } catch (error) {
            return {
                success: false,
                package: packageName,
                manager: 'npm',
                error: error.message
            };
        }
    }

    async yarnInstall(packageName) {
        try {
            const { stdout, stderr } = await execAsync(`yarn add ${packageName}`);
            return {
                success: true,
                package: packageName,
                manager: 'yarn',
                output: stdout,
                errors: stderr
            };
        } catch (error) {
            return {
                success: false,
                package: packageName,
                manager: 'yarn',
                error: error.message
            };
        }
    }

    async pipInstall(packageName) {
        try {
            const { stdout, stderr } = await execAsync(`pip install ${packageName}`);
            return {
                success: true,
                package: packageName,
                manager: 'pip',
                output: stdout,
                errors: stderr
            };
        } catch (error) {
            return {
                success: false,
                package: packageName,
                manager: 'pip',
                error: error.message
            };
        }
    }

    async aptInstall(packageName) {
        try {
            const { stdout, stderr } = await execAsync(`sudo apt-get install -y ${packageName}`);
            return {
                success: true,
                package: packageName,
                manager: 'apt',
                output: stdout,
                errors: stderr
            };
        } catch (error) {
            return {
                success: false,
                package: packageName,
                manager: 'apt',
                error: error.message
            };
        }
    }

    async brewInstall(packageName) {
        try {
            const { stdout, stderr } = await execAsync(`brew install ${packageName}`);
            return {
                success: true,
                package: packageName,
                manager: 'brew',
                output: stdout,
                errors: stderr
            };
        } catch (error) {
            return {
                success: false,
                package: packageName,
                manager: 'brew',
                error: error.message
            };
        }
    }

    async runSystemCommand(command, options = {}) {
        try {
            const { stdout, stderr } = await execAsync(command, options);
            return {
                success: true,
                command,
                output: stdout,
                errors: stderr
            };
        } catch (error) {
            return {
                success: false,
                command,
                error: error.message
            };
        }
    }
}

module.exports = PackageManager;