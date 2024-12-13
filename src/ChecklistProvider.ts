import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { format } from 'date-fns';
import * as os from 'os';

export interface ChecklistItem {
    id: string;
    label: string;
    description?: string;
    completed: boolean;
    priority: 'high' | 'medium' | 'low';
    dueDate?: Date;
    notes: string[];
    tags: string[];
}

interface DependencyAnalysis {
    name: string;
    version: string;
    size?: number;
    vulnerabilities?: Array<{
        severity: 'low' | 'medium' | 'high' | 'critical';
        description: string;
    }>;
    updates?: {
        latest: string;
        recommended: string;
        patches: string[];
    };
    alternatives?: Array<{
        name: string;
        reason: string;
    }>;
    usage?: {
        imported: boolean;
        lastUsed?: Date;
    };
    license?: {
        name: string;
        compatible: boolean;
        restrictions?: string[];
    };
    peerDependencies?: {
        [key: string]: {
            required: string;
            installed?: string;
            compatible: boolean;
        };
    };
    performance?: {
        buildImpact: number; // in milliseconds
        memoryUsage: number; // in MB
        bundleSize: number; // in KB
    };
    cache?: {
        hits: number;
        lastUsed: Date;
        size: number;
    };
}

export class ChecklistProvider implements vscode.TreeDataProvider<ChecklistItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ChecklistItem | undefined | null | void> = new vscode.EventEmitter<ChecklistItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ChecklistItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private items: ChecklistItem[] = [];

    constructor() {
        // Load saved items
        this.loadItems();
    }

    private loadItems() {
        const savedItems = vscode.workspace.getConfiguration('implementation-checklist').get<ChecklistItem[]>('items') || [];
        this.items = savedItems.map(item => ({
            ...item,
            dueDate: item.dueDate ? new Date(item.dueDate) : undefined
        }));
    }

    private saveItems() {
        vscode.workspace.getConfiguration('implementation-checklist').update('items', this.items, true);
    }

    getTreeItem(element: ChecklistItem): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(element.label);
        treeItem.id = element.id;
        treeItem.description = this.getItemDescription(element);
        treeItem.contextValue = 'checklistItem';
        treeItem.checkbox = element.completed;
        treeItem.iconPath = this.getItemIcon(element);
        treeItem.tooltip = this.getItemTooltip(element);
        return treeItem;
    }

    getChildren(element?: ChecklistItem): Thenable<ChecklistItem[]> {
        if (element) {
            return Promise.resolve([]);
        }
        return Promise.resolve(this.items);
    }

    private getItemDescription(item: ChecklistItem): string {
        const parts: string[] = [];
        if (item.dueDate) {
            parts.push(format(item.dueDate, 'yyyy-MM-dd'));
        }
        if (item.priority) {
            parts.push(`[${item.priority}]`);
        }
        if (item.tags.length > 0) {
            parts.push(item.tags.map(tag => `#${tag}`).join(' '));
        }
        return parts.join(' ');
    }

    private getItemIcon(item: ChecklistItem): vscode.ThemeIcon {
        if (item.completed) {
            return new vscode.ThemeIcon('check');
        }
        switch (item.priority) {
            case 'high':
                return new vscode.ThemeIcon('warning');
            case 'medium':
                return new vscode.ThemeIcon('info');
            case 'low':
                return new vscode.ThemeIcon('circle-outline');
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }

    private getItemTooltip(item: ChecklistItem): string {
        const parts: string[] = [item.label];
        if (item.description) {
            parts.push(item.description);
        }
        if (item.notes.length > 0) {
            parts.push('\nNotes:', ...item.notes.map(note => `- ${note}`));
        }
        return parts.join('\n');
    }

    // Command handlers
    createItem(label: string): void {
        const newItem: ChecklistItem = {
            id: Date.now().toString(),
            label,
            completed: false,
            priority: 'medium',
            notes: [],
            tags: []
        };
        this.items.push(newItem);
        this.saveItems();
        this.refresh();
    }

    editItem(item: ChecklistItem, newLabel: string): void {
        const index = this.items.findIndex(i => i.id === item.id);
        if (index !== -1) {
            this.items[index] = { ...this.items[index], label: newLabel };
            this.saveItems();
            this.refresh();
        }
    }

    deleteItem(item: ChecklistItem): void {
        this.items = this.items.filter(i => i.id !== item.id);
        this.saveItems();
        this.refresh();
    }

    toggleComplete(item: ChecklistItem): void {
        const index = this.items.findIndex(i => i.id === item.id);
        if (index !== -1) {
            this.items[index] = { ...this.items[index], completed: !this.items[index].completed };
            this.saveItems();
            this.refresh();
        }
    }

    setPriority(item: ChecklistItem, priority: 'high' | 'medium' | 'low'): void {
        const index = this.items.findIndex(i => i.id === item.id);
        if (index !== -1) {
            this.items[index] = { ...this.items[index], priority };
            this.saveItems();
            this.refresh();
        }
    }

    setDueDate(item: ChecklistItem, dueDate: Date | undefined): void {
        const index = this.items.findIndex(i => i.id === item.id);
        if (index !== -1) {
            this.items[index] = { ...this.items[index], dueDate };
            this.saveItems();
            this.refresh();
        }
    }

    addNote(item: ChecklistItem, note: string): void {
        const index = this.items.findIndex(i => i.id === item.id);
        if (index !== -1) {
            this.items[index] = {
                ...this.items[index],
                notes: [...this.items[index].notes, note]
            };
            this.saveItems();
            this.refresh();
        }
    }

    addTag(item: ChecklistItem, tag: string): void {
        const index = this.items.findIndex(i => i.id === item.id);
        if (index !== -1) {
            if (!this.items[index].tags.includes(tag)) {
                this.items[index] = {
                    ...this.items[index],
                    tags: [...this.items[index].tags, tag]
                };
                this.saveItems();
                this.refresh();
            }
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    // Filter and sort functions
    filterItems(predicate: (item: ChecklistItem) => boolean): void {
        this.items = this.items.filter(predicate);
        this.refresh();
    }

    sortItems(compareFn: (a: ChecklistItem, b: ChecklistItem) => number): void {
        this.items.sort(compareFn);
        this.refresh();
    }

    private async checkDependencyCompatibility(packagePath: string, dependencies: { [key: string]: string }): Promise<{ compatible: { [key: string]: string }, incompatible: { [key: string]: string } }> {
        const compatible: { [key: string]: string } = {};
        const incompatible: { [key: string]: string } = {};

        // Lees bestaande package.json
        const packageJsonPath = path.join(path.dirname(packagePath), 'package.json');
        const packageContent = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        const existingDeps = { ...packageContent.dependencies || {}, ...packageContent.devDependencies || {} };

        for (const [dep, version] of Object.entries(dependencies)) {
            try {
                // Controleer of dependency al bestaat
                if (existingDeps[dep]) {
                    const existing = existingDeps[dep].replace(/[\^~]/g, '');
                    const requested = version.replace(/[\^~]/g, '');

                    // Simpele versie vergelijking (kan uitgebreid worden met semver)
                    if (existing === requested) {
                        continue; // Skip als versie exact hetzelfde is
                    }

                    // Check major version compatibility
                    const existingMajor = existing.split('.')[0];
                    const requestedMajor = requested.split('.')[0];

                    if (existingMajor === requestedMajor) {
                        compatible[dep] = version;
                    } else {
                        incompatible[dep] = version;
                    }
                } else {
                    // Nieuwe dependency
                    compatible[dep] = version;
                }
            } catch (error) {
                console.error(`Error checking compatibility for ${dep}:`, error);
                incompatible[dep] = version;
            }
        }

        return { compatible, incompatible };
    }

    private async installDependencies(packagePath: string, dependencies: { [key: string]: string }): Promise<boolean> {
        try {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(packagePath));
            if (!workspaceFolder) {
                throw new Error('No workspace folder found');
            }

            const installCmd = Object.entries(dependencies)
                .map(([name, version]) => `${name}@${version}`)
                .join(' ');

            if (!installCmd) {
                return true; // Niets om te installeren
            }

            // Voer npm install uit
            const terminal = vscode.window.createTerminal('Dependency Installation');
            terminal.show();
            terminal.sendText(`cd "${path.dirname(packagePath)}"`);
            terminal.sendText(`npm install ${installCmd}`);

            return true;
        } catch (error) {
            console.error('Error installing dependencies:', error);
            return false;
        }
    }

    private async analyzeDependency(name: string, version: string): Promise<DependencyAnalysis> {
        try {
            // Voer npm audit uit voor security info
            const auditResult = await this.runNpmCommand(`npm audit ${name}@${version} --json`);
            const vulnerabilities = this.parseAuditResult(auditResult);

            // Check package grootte
            const sizeResult = await this.runNpmCommand(`npm view ${name}@${version} dist.size --json`);
            const size = parseInt(sizeResult);

            // Check updates
            const updatesResult = await this.runNpmCommand(`npm view ${name} versions --json`);
            const updates = this.analyzeUpdates(version, JSON.parse(updatesResult));

            // Zoek alternatieven
            const alternatives = await this.findAlternatives(name);

            // Analyseer gebruik in project
            const usage = await this.analyzePackageUsage(name);

            // Nieuwe analyses
            const license = await this.checkLicenseCompliance(name, version);
            const peerDependencies = await this.checkPeerDependencies(name, version);
            const performance = await this.measureBuildPerformance(name);
            const cache = await this.setupDependencyCache(name);

            return {
                name,
                version,
                size,
                vulnerabilities,
                updates,
                alternatives,
                usage,
                license,
                peerDependencies,
                performance,
                cache
            };
        } catch (error) {
            console.error(`Error analyzing dependency ${name}:`, error);
            return { name, version };
        }
    }

    private async runNpmCommand(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const terminal = vscode.window.createTerminal('Dependency Analysis');
            let output = '';
            
            const disposable = vscode.window.onDidWriteTerminalData(e => {
                if (e.terminal === terminal) {
                    output += e.data;
                }
            });

            terminal.sendText(`${command} > /tmp/npm-output.txt`);
            terminal.sendText('echo "DONE" >> /tmp/npm-output.txt');

            const checkInterval = setInterval(async () => {
                try {
                    const content = await fs.readFile('/tmp/npm-output.txt', 'utf-8');
                    if (content.includes('DONE')) {
                        clearInterval(checkInterval);
                        disposable.dispose();
                        terminal.dispose();
                        resolve(content.replace('DONE', '').trim());
                    }
                } catch (error) {
                    // Bestand bestaat nog niet of is niet leesbaar
                }
            }, 100);
        });
    }

    private parseAuditResult(auditOutput: string): Array<{ severity: 'low' | 'medium' | 'high' | 'critical'; description: string; }> {
        try {
            const audit = JSON.parse(auditOutput);
            return Object.values(audit.advisories || {}).map((adv: any) => ({
                severity: adv.severity,
                description: adv.overview
            }));
        } catch (error) {
            console.error('Error parsing audit result:', error);
            return [];
        }
    }

    private analyzeUpdates(currentVersion: string, allVersions: string[]): { latest: string; recommended: string; patches: string[]; } {
        const current = currentVersion.replace(/[\^~]/g, '');
        const [currentMajor, currentMinor] = current.split('.').map(Number);

        const patches = allVersions.filter(v => {
            const [major, minor] = v.split('.').map(Number);
            return major === currentMajor && minor === currentMinor;
        });

        const latest = allVersions[allVersions.length - 1];
        const recommended = allVersions.find(v => {
            const [major] = v.split('.').map(Number);
            return major === currentMajor;
        }) || latest;

        return {
            latest,
            recommended,
            patches: patches.filter(p => p !== current)
        };
    }

    private async findAlternatives(packageName: string): Promise<Array<{ name: string; reason: string; }>> {
        // Dit zou kunnen worden uitgebreid met een echte API call naar een package vergelijkingsservice
        const commonAlternatives: { [key: string]: Array<{ name: string; reason: string; }> } = {
            'moment': [
                { name: 'date-fns', reason: 'Lighter weight, tree-shakeable' },
                { name: 'dayjs', reason: 'Smaller bundle size, similar API' }
            ],
            'lodash': [
                { name: 'ramda', reason: 'More functional programming focused' },
                { name: 'native methods', reason: 'Modern JS has many built-in alternatives' }
            ],
            'request': [
                { name: 'axios', reason: 'Modern, Promise-based HTTP client' },
                { name: 'node-fetch', reason: 'Lighter weight, matches fetch API' }
            ]
        };

        return commonAlternatives[packageName] || [];
    }

    private async analyzePackageUsage(packageName: string): Promise<{ imported: boolean; lastUsed?: Date; }> {
        try {
            // Zoek imports van het package
            const files = await vscode.workspace.findFiles('**/*.{js,jsx,ts,tsx}', '**/node_modules/**');
            let imported = false;
            let lastUsed: Date | undefined;

            for (const file of files) {
                const content = await vscode.workspace.openTextDocument(file);
                const text = content.getText();
                
                // Check voor verschillende import styles
                const hasImport = text.includes(`import`) && text.includes(packageName) ||
                                text.includes(`require('${packageName}')`) ||
                                text.includes(`require("${packageName}")`);
                
                if (hasImport) {
                    imported = true;
                    const stats = await fs.stat(file.fsPath);
                    if (!lastUsed || stats.mtime > lastUsed) {
                        lastUsed = stats.mtime;
                    }
                }
            }

            return { imported, lastUsed };
        } catch (error) {
            console.error(`Error analyzing usage for ${packageName}:`, error);
            return { imported: false };
        }
    }

    private async visualizeDependencyTree(packagePath: string): Promise<void> {
        try {
            const terminal = vscode.window.createTerminal('Dependency Tree');
            terminal.show();
            terminal.sendText(`cd "${path.dirname(packagePath)}"`);
            terminal.sendText('npm ls --all');
        } catch (error) {
            console.error('Error visualizing dependency tree:', error);
        }
    }

    private async checkLicenseCompliance(packageName: string, version: string): Promise<{ name: string; compatible: boolean; restrictions?: string[]; }> {
        try {
            const licenseInfo = await this.runNpmCommand(`npm view ${packageName}@${version} license --json`);
            const license = JSON.parse(licenseInfo);
            
            // Lijst van compatibele licenties
            const compatibleLicenses = ['MIT', 'Apache-2.0', 'ISC', 'BSD-3-Clause', 'BSD-2-Clause'];
            const restrictedLicenses = ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0'];
            
            return {
                name: license,
                compatible: compatibleLicenses.includes(license),
                restrictions: restrictedLicenses.includes(license) ? 
                    ['Requires source disclosure', 'Derivative works must be open source'] : undefined
            };
        } catch (error) {
            console.error(`Error checking license for ${packageName}:`, error);
            return { name: 'UNKNOWN', compatible: false };
        }
    }

    private async checkPeerDependencies(packageName: string, version: string): Promise<{ [key: string]: { required: string; installed?: string; compatible: boolean; } }> {
        try {
            const peerDepsInfo = await this.runNpmCommand(`npm view ${packageName}@${version} peerDependencies --json`);
            const peerDeps = JSON.parse(peerDepsInfo);
            const result: { [key: string]: { required: string; installed?: string; compatible: boolean; } } = {};
            
            for (const [peer, required] of Object.entries(peerDeps)) {
                const installed = await this.getInstalledVersion(peer);
                result[peer] = {
                    required: required as string,
                    installed,
                    compatible: this.checkVersionCompatibility(required as string, installed)
                };
            }
            
            return result;
        } catch (error) {
            console.error(`Error checking peer dependencies for ${packageName}:`, error);
            return {};
        }
    }

    private async getInstalledVersion(packageName: string): Promise<string | undefined> {
        try {
            const packageJsonPath = await vscode.workspace.findFiles('**/node_modules/' + packageName + '/package.json', '**/node_modules/**/node_modules/**');
            if (packageJsonPath.length > 0) {
                const content = await vscode.workspace.openTextDocument(packageJsonPath[0]);
                const pkg = JSON.parse(content.getText());
                return pkg.version;
            }
            return undefined;
        } catch (error) {
            console.error(`Error getting installed version for ${packageName}:`, error);
            return undefined;
        }
    }

    private async measureBuildPerformance(packageName: string): Promise<{ buildImpact: number; memoryUsage: number; bundleSize: number; }> {
        try {
            // Maak een tijdelijk test project
            const tmpDir = path.join(os.tmpdir(), `perf-test-${Date.now()}`);
            await fs.mkdir(tmpDir, { recursive: true });
            
            // Basis package.json maken
            await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({
                name: 'perf-test',
                version: '1.0.0',
                dependencies: { [packageName]: '*' }
            }));
            
            // Meet installatie tijd
            const startTime = process.hrtime();
            await this.runNpmCommand(`cd "${tmpDir}" && npm install`);
            const [seconds, nanoseconds] = process.hrtime(startTime);
            const buildImpact = seconds * 1000 + nanoseconds / 1000000;
            
            // Meet bundle grootte
            const bundleSize = await this.measureBundleSize(tmpDir, packageName);
            
            // Meet geheugen gebruik
            const memoryUsage = await this.measureMemoryUsage(tmpDir, packageName);
            
            // Ruim tijdelijk project op
            await fs.rm(tmpDir, { recursive: true, force: true });
            
            return {
                buildImpact,
                memoryUsage,
                bundleSize
            };
        } catch (error) {
            console.error(`Error measuring performance for ${packageName}:`, error);
            return {
                buildImpact: 0,
                memoryUsage: 0,
                bundleSize: 0
            };
        }
    }

    private async measureBundleSize(projectDir: string, packageName: string): Promise<number> {
        try {
            const webpackConfig = `
                const path = require('path');
                module.exports = {
                    entry: './index.js',
                    output: {
                        path: path.resolve(__dirname, 'dist'),
                        filename: 'bundle.js'
                    },
                    mode: 'production'
                };
            `;
            
            const testFile = `import pkg from '${packageName}';`;
            
            await fs.writeFile(path.join(projectDir, 'webpack.config.js'), webpackConfig);
            await fs.writeFile(path.join(projectDir, 'index.js'), testFile);
            
            await this.runNpmCommand(`cd "${projectDir}" && npx webpack`);
            
            const stats = await fs.stat(path.join(projectDir, 'dist', 'bundle.js'));
            return Math.round(stats.size / 1024); // Convert to KB
        } catch (error) {
            console.error(`Error measuring bundle size for ${packageName}:`, error);
            return 0;
        }
    }

    private async measureMemoryUsage(projectDir: string, packageName: string): Promise<number> {
        try {
            const testFile = `
                const pkg = require('${packageName}');
                console.log(process.memoryUsage().heapUsed);
            `;
            
            await fs.writeFile(path.join(projectDir, 'memory-test.js'), testFile);
            
            const result = await this.runNpmCommand(`cd "${projectDir}" && node memory-test.js`);
            return Math.round(parseInt(result) / (1024 * 1024)); // Convert to MB
        } catch (error) {
            console.error(`Error measuring memory usage for ${packageName}:`, error);
            return 0;
        }
    }

    private async setupDependencyCache(packageName: string): Promise<{ hits: number; lastUsed: Date; size: number; }> {
        try {
            const cacheDir = path.join(os.tmpdir(), 'npm-cache');
            await fs.mkdir(cacheDir, { recursive: true });
            
            // Cache configuratie
            await this.runNpmCommand(`npm config set cache "${cacheDir}"`);
            
            // Cache statistieken verzamelen
            const cacheStats = await this.runNpmCommand(`npm cache verify --json`);
            const stats = JSON.parse(cacheStats);
            
            return {
                hits: stats.hits || 0,
                lastUsed: new Date(),
                size: stats.size || 0
            };
        } catch (error) {
            console.error(`Error setting up cache for ${packageName}:`, error);
            return {
                hits: 0,
                lastUsed: new Date(),
                size: 0
            };
        }
    }

    private createLicenseComplianceItem(packageJsonUri: vscode.Uri, nonCompliantDeps: DependencyAnalysis[]) {
        const item: ChecklistItem = {
            id: `license-${Date.now()}-${Math.random()}`,
            label: `License Compliance Issues: ${vscode.workspace.asRelativePath(packageJsonUri)}`,
            description: `${nonCompliantDeps.length} license compliance issues found`,
            completed: false,
            priority: 'high',
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
            notes: [
                `License compliance issues found in ${vscode.workspace.asRelativePath(packageJsonUri)}:`,
                ...nonCompliantDeps.flatMap(dep => [
                    `- ${dep.name}@${dep.version}:`,
                    `  License: ${dep.license?.name}`,
                    ...(dep.license?.restrictions || []).map(r => `  * ${r}`)
                ])
            ],
            tags: ['license', 'compliance', 'legal', 'dependencies']
        };
        this.items.push(item);
    }

    private createPeerDependencyItem(packageJsonUri: vscode.Uri, peerDeps: DependencyAnalysis[]) {
        const item: ChecklistItem = {
            id: `peer-${Date.now()}-${Math.random()}`,
            label: `Peer Dependency Issues: ${vscode.workspace.asRelativePath(packageJsonUri)}`,
            description: `${peerDeps.length} peer dependency issues found`,
            completed: false,
            priority: 'high',
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            notes: [
                `Peer dependency issues found in ${vscode.workspace.asRelativePath(packageJsonUri)}:`,
                ...peerDeps.flatMap(dep => [
                    `- ${dep.name}@${dep.version}:`,
                    ...Object.entries(dep.peerDependencies || {})
                        .filter(([, info]) => !info.compatible)
                        .map(([peer, info]) => 
                            `  * ${peer}: requires ${info.required}, found ${info.installed || 'not installed'}`
                        )
                ])
            ],
            tags: ['peer-dependencies', 'compatibility', 'dependencies']
        };
        this.items.push(item);
    }

    private createPerformanceItem(packageJsonUri: vscode.Uri, perfIssues: DependencyAnalysis[]) {
        const item: ChecklistItem = {
            id: `perf-${Date.now()}-${Math.random()}`,
            label: `Performance Optimization: ${vscode.workspace.asRelativePath(packageJsonUri)}`,
            description: `${perfIssues.length} performance issues found`,
            completed: false,
            priority: 'medium',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Week
            notes: [
                `Performance issues found in ${vscode.workspace.asRelativePath(packageJsonUri)}:`,
                ...perfIssues.map(dep => [
                    `- ${dep.name}@${dep.version}:`,
                    `  * Build Impact: ${dep.performance?.buildImpact.toFixed(2)}ms`,
                    `  * Memory Usage: ${dep.performance?.memoryUsage}MB`,
                    `  * Bundle Size: ${dep.performance?.bundleSize}KB`,
                    ...(dep.alternatives || []).map(alt => `  * Consider ${alt.name}: ${alt.reason}`)
                ].join('\n'))
            ],
            tags: ['performance', 'optimization', 'dependencies']
        };
        this.items.push(item);
    }

    private async scanWorkspaceForDependencies() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showInformationMessage('No workspace folder open');
            return;
        }

        for (const folder of workspaceFolders) {
            const packageJsonFiles = await vscode.workspace.findFiles(
                new vscode.RelativePattern(folder, '**/package.json'),
                '**/node_modules/**'
            );

            for (const packageJsonUri of packageJsonFiles) {
                try {
                    const document = await vscode.workspace.openTextDocument(packageJsonUri);
                    const content = JSON.parse(document.getText());
                    
                    const dependencies = {
                        ...content.dependencies || {},
                        ...content.devDependencies || {}
                    };

                    if (Object.keys(dependencies).length === 0) {
                        continue;
                    }

                    // Analyseer elke dependency
                    const analysisResults: DependencyAnalysis[] = [];
                    for (const [name, version] of Object.entries(dependencies)) {
                        const analysis = await this.analyzeDependency(name, version);
                        analysisResults.push(analysis);
                    }

                    // Groepeer resultaten
                    const vulnerable = analysisResults.filter(r => r.vulnerabilities?.length);
                    const outdated = analysisResults.filter(r => r.updates?.patches.length);
                    const unused = analysisResults.filter(r => r.usage && !r.usage.imported);
                    const large = analysisResults.filter(r => r.size && r.size > 1000000);
                    const nonCompliant = analysisResults.filter(r => r.license && !r.license.compatible);
                    const peerIssues = analysisResults.filter(r => 
                        r.peerDependencies && Object.values(r.peerDependencies).some(p => !p.compatible)
                    );
                    const perfIssues = analysisResults.filter(r => 
                        r.performance && (
                            r.performance.buildImpact > 1000 || // > 1s build impact
                            r.performance.memoryUsage > 100 || // > 100MB memory
                            r.performance.bundleSize > 500 // > 500KB bundle
                        )
                    );

                    // Maak checklist items voor verschillende categorieën
                    if (vulnerable.length > 0) {
                        this.createSecurityChecklistItem(packageJsonUri, vulnerable);
                    }

                    if (outdated.length > 0) {
                        this.createUpdateChecklistItem(packageJsonUri, outdated);
                    }

                    if (unused.length > 0) {
                        this.createCleanupChecklistItem(packageJsonUri, unused);
                    }

                    if (large.length > 0) {
                        this.createOptimizationChecklistItem(packageJsonUri, large);
                    }

                    if (nonCompliant.length > 0) {
                        this.createLicenseComplianceItem(packageJsonUri, nonCompliant);
                    }

                    if (peerIssues.length > 0) {
                        this.createPeerDependencyItem(packageJsonUri, peerIssues);
                    }

                    if (perfIssues.length > 0) {
                        this.createPerformanceItem(packageJsonUri, perfIssues);
                    }

                    // Visualiseer dependency tree
                    await this.visualizeDependencyTree(packageJsonUri.fsPath);

                    // Installeer compatibele updates
                    const patchUpdates = outdated
                        .filter(d => d.updates?.patches.length === 1)
                        .reduce((acc, d) => {
                            acc[d.name] = d.updates!.patches[0];
                            return acc;
                        }, {} as { [key: string]: string });

                    if (Object.keys(patchUpdates).length > 0) {
                        const success = await this.installDependencies(packageJsonUri.fsPath, patchUpdates);
                        if (success) {
                            vscode.window.showInformationMessage(
                                `Successfully installed ${Object.keys(patchUpdates).length} patch updates in ${vscode.workspace.asRelativePath(packageJsonUri)}`
                            );
                        }
                    }

                } catch (error) {
                    console.error(`Error processing ${packageJsonUri.fsPath}:`, error);
                    vscode.window.showErrorMessage(`Error processing dependencies in ${vscode.workspace.asRelativePath(packageJsonUri)}`);
                }
            }
        }

        this.saveItems();
        this._onDidChangeTreeData.fire();
    }

    public async scanWorkspace() {
        await this.scanWorkspaceForDependencies();
    }
}
