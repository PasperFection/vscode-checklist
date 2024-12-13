import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IChecklistItem } from './types';
import { NotificationProvider } from './NotificationProvider';

export class BackupProvider {
    private static instance: BackupProvider;
    private readonly backupDir: string;
    private readonly maxBackups = 10;

    private constructor() {
        this.backupDir = path.join(
            vscode.workspace.workspaceFolders?.[0].uri.fsPath || '',
            '.implementation-checklist-backups'
        );
        this.ensureBackupDirectory();
    }

    public static getInstance(): BackupProvider {
        if (!BackupProvider.instance) {
            BackupProvider.instance = new BackupProvider();
        }
        return BackupProvider.instance;
    }

    private async ensureBackupDirectory() {
        if (!fs.existsSync(this.backupDir)) {
            await fs.promises.mkdir(this.backupDir, { recursive: true });
        }
    }

    public async createBackup(items: IChecklistItem[]): Promise<void> {
        const notification = NotificationProvider.getInstance();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(this.backupDir, `backup-${timestamp}.json`);

        try {
            // Create backup
            await fs.promises.writeFile(
                backupPath,
                JSON.stringify({
                    timestamp: new Date().toISOString(),
                    items: items
                }, null, 2)
            );

            // Clean up old backups
            await this.cleanupOldBackups();

            notification.showNotification('Backup created successfully', 'info');
        } catch (error) {
            notification.showNotification('Failed to create backup', 'error');
            throw error;
        }
    }

    private async cleanupOldBackups() {
        const backups = await fs.promises.readdir(this.backupDir);
        if (backups.length <= this.maxBackups) {
            return;
        }

        const sortedBackups = backups
            .filter(file => file.startsWith('backup-'))
            .sort((a, b) => {
                const timeA = this.getBackupTimestamp(a);
                const timeB = this.getBackupTimestamp(b);
                return timeB.getTime() - timeA.getTime();
            });

        const backupsToDelete = sortedBackups.slice(this.maxBackups);
        for (const backup of backupsToDelete) {
            await fs.promises.unlink(path.join(this.backupDir, backup));
        }
    }

    private getBackupTimestamp(filename: string): Date {
        const match = filename.match(/backup-(.+)\.json/);
        if (match) {
            const timestamp = match[1].replace(/-/g, ':');
            return new Date(timestamp);
        }
        return new Date(0);
    }

    public async restoreBackup(backupFile: string): Promise<IChecklistItem[]> {
        const notification = NotificationProvider.getInstance();
        const backupPath = path.join(this.backupDir, backupFile);

        try {
            const data = await fs.promises.readFile(backupPath, 'utf8');
            const backup = JSON.parse(data);
            notification.showNotification('Backup restored successfully', 'info');
            return backup.items;
        } catch (error) {
            notification.showNotification('Failed to restore backup', 'error');
            throw error;
        }
    }

    public async listBackups(): Promise<{ file: string; timestamp: string }[]> {
        const backups = await fs.promises.readdir(this.backupDir);
        return backups
            .filter(file => file.startsWith('backup-'))
            .map(file => ({
                file,
                timestamp: this.getBackupTimestamp(file).toISOString()
            }))
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }

    public async autoBackup(items: IChecklistItem[]): Promise<void> {
        const lastBackup = await this.getLastBackupTime();
        const now = new Date();
        const hoursSinceLastBackup = (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60);

        if (hoursSinceLastBackup >= 24) {
            await this.createBackup(items);
        }
    }

    private async getLastBackupTime(): Promise<Date> {
        const backups = await this.listBackups();
        if (backups.length === 0) {
            return new Date(0);
        }
        return new Date(backups[0].timestamp);
    }

    public async exportBackups(exportPath: string): Promise<void> {
        const notification = NotificationProvider.getInstance();
        try {
            const backups = await this.listBackups();
            const exportData = {
                exportDate: new Date().toISOString(),
                backups: await Promise.all(
                    backups.map(async backup => {
                        const data = await fs.promises.readFile(
                            path.join(this.backupDir, backup.file),
                            'utf8'
                        );
                        return {
                            timestamp: backup.timestamp,
                            data: JSON.parse(data)
                        };
                    })
                )
            };

            await fs.promises.writeFile(
                exportPath,
                JSON.stringify(exportData, null, 2)
            );
            notification.showNotification('Backups exported successfully', 'info');
        } catch (error) {
            notification.showNotification('Failed to export backups', 'error');
            throw error;
        }
    }

    public async importBackups(importPath: string): Promise<void> {
        const notification = NotificationProvider.getInstance();
        try {
            const importData = JSON.parse(
                await fs.promises.readFile(importPath, 'utf8')
            );

            for (const backup of importData.backups) {
                const timestamp = new Date(backup.timestamp)
                    .toISOString()
                    .replace(/[:.]/g, '-');
                const backupPath = path.join(
                    this.backupDir,
                    `backup-${timestamp}.json`
                );

                await fs.promises.writeFile(
                    backupPath,
                    JSON.stringify(backup.data, null, 2)
                );
            }

            await this.cleanupOldBackups();
            notification.showNotification('Backups imported successfully', 'info');
        } catch (error) {
            notification.showNotification('Failed to import backups', 'error');
            throw error;
        }
    }
}
