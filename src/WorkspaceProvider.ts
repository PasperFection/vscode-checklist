import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { IChecklistItem } from './types';
import { NotificationProvider } from './NotificationProvider';

export class WorkspaceProvider {
    private static instance: WorkspaceProvider;
    private readonly configFileName = '.implementation-checklist.json';
    private readonly gitignoreEntry = '.implementation-checklist.json';
    private workspaceWatcher: vscode.FileSystemWatcher | undefined;
    private isUpdating = false;

    private constructor() {
        this.setupWorkspaceWatcher();
        this.ensureGitignore();
    }

    public static getInstance(): WorkspaceProvider {
        if (!WorkspaceProvider.instance) {
            WorkspaceProvider.instance = new WorkspaceProvider();
        }
        return WorkspaceProvider.instance;
    }

    private setupWorkspaceWatcher() {
        if (vscode.workspace.workspaceFolders) {
            this.workspaceWatcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(
                    vscode.workspace.workspaceFolders[0],
                    this.configFileName
                )
            );

            this.workspaceWatcher.onDidChange(async () => {
                if (!this.isUpdating) {
                    await this.handleConfigChange();
                }
            });
        }
    }

    private async handleConfigChange() {
        const notification = NotificationProvider.getInstance();
        try {
            const items = await this.loadFromWorkspace();
            vscode.commands.executeCommand('implementation-checklist.updateItems', items);
            notification.showNotification('Checklist synchronized with workspace', 'info');
        } catch (error) {
            notification.showNotification('Failed to sync checklist with workspace', 'error');
        }
    }

    private async ensureGitignore() {
        if (!vscode.workspace.workspaceFolders) {
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const gitignorePath = path.join(workspaceRoot, '.gitignore');

        try {
            let content = '';
            if (fs.existsSync(gitignorePath)) {
                content = await fs.promises.readFile(gitignorePath, 'utf8');
            }

            if (!content.includes(this.gitignoreEntry)) {
                content += `\n${this.gitignoreEntry}\n`;
                await fs.promises.writeFile(gitignorePath, content, 'utf8');
            }
        } catch (error) {
            console.error('Failed to update .gitignore:', error);
        }
    }

    public async saveToWorkspace(items: IChecklistItem[]): Promise<void> {
        if (!vscode.workspace.workspaceFolders) {
            throw new Error('No workspace folder is open');
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const configPath = path.join(workspaceRoot, this.configFileName);

        try {
            this.isUpdating = true;
            const data = JSON.stringify(items, null, 2);
            await fs.promises.writeFile(configPath, data, 'utf8');
            NotificationProvider.getInstance().showNotification(
                'Checklist saved to workspace',
                'info'
            );
        } catch (error) {
            NotificationProvider.getInstance().showNotification(
                'Failed to save checklist to workspace',
                'error'
            );
            throw error;
        } finally {
            this.isUpdating = false;
        }
    }

    public async loadFromWorkspace(): Promise<IChecklistItem[]> {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const configPath = path.join(workspaceRoot, this.configFileName);

        try {
            const data = await fs.promises.readFile(configPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return [];
        }
    }

    public async syncWithRemote(): Promise<void> {
        const notification = NotificationProvider.getInstance();
        const progress = await notification.showProgressNotification(
            'Synchronizing checklist with remote...',
            100
        );

        try {
            // Check if git is available
            const gitPath = path.join(
                vscode.workspace.workspaceFolders?.[0].uri.fsPath || '',
                '.git'
            );
            if (!fs.existsSync(gitPath)) {
                throw new Error('Git repository not found');
            }

            // Get current branch
            const branch = await this.executeGitCommand('rev-parse --abbrev-ref HEAD');
            
            // Pull latest changes
            progress.report({ message: 'Pulling latest changes...', increment: 30 });
            await this.executeGitCommand('pull origin ' + branch);

            // Stage changes
            progress.report({ message: 'Staging changes...', increment: 30 });
            await this.executeGitCommand('add ' + this.configFileName);

            // Commit changes
            progress.report({ message: 'Committing changes...', increment: 20 });
            await this.executeGitCommand('commit -m "Update implementation checklist"');

            // Push changes
            progress.report({ message: 'Pushing changes...', increment: 20 });
            await this.executeGitCommand('push origin ' + branch);

            notification.showNotification('Checklist synchronized with remote', 'info');
        } catch (error) {
            notification.showNotification(
                'Failed to sync checklist with remote: ' + (error as Error).message,
                'error'
            );
        }
    }

    private async executeGitCommand(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const { exec } = require('child_process');
            exec(
                'git ' + command,
                { cwd: vscode.workspace.workspaceFolders?.[0].uri.fsPath },
                (error: Error | null, stdout: string, stderr: string) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(stdout.trim());
                }
            );
        });
    }

    public dispose() {
        this.workspaceWatcher?.dispose();
    }
}
