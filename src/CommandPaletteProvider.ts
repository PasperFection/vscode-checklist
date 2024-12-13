import * as vscode from 'vscode';
import { WorkspaceProvider } from './WorkspaceProvider';
import { BackupProvider } from './BackupProvider';
import { NotificationProvider } from './NotificationProvider';
import { DataProvider } from './DataProvider';
import { ThemeProvider } from './ThemeProvider';
import { AnalyticsProvider } from './AnalyticsProvider';
import { IChecklistItem } from './types';
import { format } from 'date-fns';

export class CommandPaletteProvider {
    private static instance: CommandPaletteProvider;
    private readonly context: vscode.ExtensionContext;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.registerCommands();
    }

    public static getInstance(context?: vscode.ExtensionContext): CommandPaletteProvider {
        if (!CommandPaletteProvider.instance) {
            if (!context) {
                throw new Error('Context required for initialization');
            }
            CommandPaletteProvider.instance = new CommandPaletteProvider(context);
        }
        return CommandPaletteProvider.instance;
    }

    private registerCommands() {
        // Workspace commands
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'implementation-checklist.syncWorkspace',
                this.syncWorkspace.bind(this)
            ),
            vscode.commands.registerCommand(
                'implementation-checklist.syncWithRemote',
                this.syncWithRemote.bind(this)
            ),

            // Backup commands
            vscode.commands.registerCommand(
                'implementation-checklist.createBackup',
                this.createBackup.bind(this)
            ),
            vscode.commands.registerCommand(
                'implementation-checklist.restoreBackup',
                this.restoreBackup.bind(this)
            ),
            vscode.commands.registerCommand(
                'implementation-checklist.exportBackups',
                this.exportBackups.bind(this)
            ),
            vscode.commands.registerCommand(
                'implementation-checklist.importBackups',
                this.importBackups.bind(this)
            ),

            // Data commands
            vscode.commands.registerCommand(
                'implementation-checklist.exportData',
                this.exportData.bind(this)
            ),
            vscode.commands.registerCommand(
                'implementation-checklist.importData',
                this.importData.bind(this)
            ),

            // Theme commands
            vscode.commands.registerCommand(
                'implementation-checklist.selectTheme',
                this.selectTheme.bind(this)
            ),

            // Help commands
            vscode.commands.registerCommand(
                'implementation-checklist.showHelp',
                this.showHelp.bind(this)
            ),

            // Quick actions
            vscode.commands.registerCommand(
                'implementation-checklist.quickAdd',
                this.quickAdd.bind(this)
            ),
            vscode.commands.registerCommand(
                'implementation-checklist.quickFind',
                this.quickFind.bind(this)
            ),
            vscode.commands.registerCommand(
                'implementation-checklist.quickFilter',
                this.quickFilter.bind(this)
            ),
            vscode.commands.registerCommand(
                'implementation-checklist.quickStats',
                this.quickStats.bind(this)
            )
        );
    }

    private async syncWorkspace() {
        try {
            const items = await vscode.commands.executeCommand<IChecklistItem[]>('implementation-checklist.getItems');
            if (!items) throw new Error('Failed to get items');
            
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Syncing with workspace...',
                cancellable: false
            }, async () => {
                await WorkspaceProvider.getInstance().saveToWorkspace(items);
                await AnalyticsProvider.getInstance().trackEvent('workspace.sync');
            });

            NotificationProvider.getInstance().showNotification(
                'Successfully synced with workspace',
                'info'
            );
        } catch (error) {
            NotificationProvider.getInstance().showNotification(
                'Failed to sync with workspace: ' + (error instanceof Error ? error.message : 'Unknown error'),
                'error'
            );
        }
    }

    private async syncWithRemote() {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Syncing with remote...',
                cancellable: true
            }, async (progress, token) => {
                await WorkspaceProvider.getInstance().syncWithRemote(token);
                await AnalyticsProvider.getInstance().trackEvent('workspace.syncRemote');
            });

            NotificationProvider.getInstance().showNotification(
                'Successfully synced with remote',
                'info'
            );
        } catch (error) {
            if (error instanceof Error && error.message === 'Operation cancelled') {
                NotificationProvider.getInstance().showNotification(
                    'Remote sync cancelled',
                    'info'
                );
            } else {
                NotificationProvider.getInstance().showNotification(
                    'Failed to sync with remote: ' + (error instanceof Error ? error.message : 'Unknown error'),
                    'error'
                );
            }
        }
    }

    private async createBackup() {
        try {
            const items = await vscode.commands.executeCommand<IChecklistItem[]>('implementation-checklist.getItems');
            if (!items) throw new Error('Failed to get items');

            const backupName = await vscode.window.showInputBox({
                prompt: 'Enter backup name (optional)',
                placeHolder: `Backup ${format(new Date(), 'yyyy-MM-dd HH:mm')}`
            });

            if (backupName === undefined) return; // User cancelled

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Creating backup...',
                cancellable: false
            }, async () => {
                await BackupProvider.getInstance().createBackup(items, backupName || undefined);
                await AnalyticsProvider.getInstance().trackEvent('backup.create');
            });

            NotificationProvider.getInstance().showNotification(
                'Backup created successfully',
                'info'
            );
        } catch (error) {
            NotificationProvider.getInstance().showNotification(
                'Failed to create backup: ' + (error instanceof Error ? error.message : 'Unknown error'),
                'error'
            );
        }
    }

    private async restoreBackup() {
        try {
            const backups = await BackupProvider.getInstance().listBackups();
            if (backups.length === 0) {
                NotificationProvider.getInstance().showNotification(
                    'No backups found',
                    'warning'
                );
                return;
            }

            const selected = await vscode.window.showQuickPick(
                backups.map(backup => ({
                    label: backup.name || format(new Date(backup.timestamp), 'yyyy-MM-dd HH:mm'),
                    description: `${backup.itemCount} items`,
                    detail: `Created on ${format(new Date(backup.timestamp), 'yyyy-MM-dd HH:mm')}`,
                    backup
                })),
                {
                    placeHolder: 'Select backup to restore',
                    title: 'Restore Backup'
                }
            );

            if (!selected) return;

            const confirm = await vscode.window.showWarningMessage(
                'This will replace your current checklist. Are you sure?',
                { modal: true },
                'Yes'
            );

            if (confirm !== 'Yes') return;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Restoring backup...',
                cancellable: false
            }, async () => {
                await BackupProvider.getInstance().restoreBackup(selected.backup.file);
                await AnalyticsProvider.getInstance().trackEvent('backup.restore');
            });

            NotificationProvider.getInstance().showNotification(
                'Backup restored successfully',
                'info'
            );
        } catch (error) {
            NotificationProvider.getInstance().showNotification(
                'Failed to restore backup: ' + (error instanceof Error ? error.message : 'Unknown error'),
                'error'
            );
        }
    }

    private async exportBackups() {
        try {
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file('checklist-backups.zip'),
                filters: {
                    'ZIP files': ['zip']
                }
            });

            if (!uri) return;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Exporting backups...',
                cancellable: false
            }, async () => {
                await BackupProvider.getInstance().exportBackups(uri.fsPath);
                await AnalyticsProvider.getInstance().trackEvent('backup.export');
            });

            NotificationProvider.getInstance().showNotification(
                'Backups exported successfully',
                'info'
            );
        } catch (error) {
            NotificationProvider.getInstance().showNotification(
                'Failed to export backups: ' + (error instanceof Error ? error.message : 'Unknown error'),
                'error'
            );
        }
    }

    private async importBackups() {
        try {
            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'ZIP files': ['zip']
                }
            });

            if (!uri || uri.length === 0) return;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Importing backups...',
                cancellable: false
            }, async () => {
                await BackupProvider.getInstance().importBackups(uri[0].fsPath);
                await AnalyticsProvider.getInstance().trackEvent('backup.import');
            });

            NotificationProvider.getInstance().showNotification(
                'Backups imported successfully',
                'info'
            );
        } catch (error) {
            NotificationProvider.getInstance().showNotification(
                'Failed to import backups: ' + (error instanceof Error ? error.message : 'Unknown error'),
                'error'
            );
        }
    }

    private async exportData() {
        try {
            const format = await vscode.window.showQuickPick(
                [
                    { label: 'JSON', value: 'json', description: 'Export as JSON file' },
                    { label: 'Markdown', value: 'md', description: 'Export as Markdown file' },
                    { label: 'CSV', value: 'csv', description: 'Export as CSV file' }
                ],
                { placeHolder: 'Select export format' }
            );

            if (!format) return;

            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(`checklist-export.${format.value}`),
                filters: {
                    'All Files': ['*']
                }
            });

            if (!uri) return;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Exporting data...',
                cancellable: false
            }, async () => {
                await DataProvider.getInstance().exportData(uri.fsPath, format.value);
                await AnalyticsProvider.getInstance().trackEvent('data.export', { format: format.value });
            });

            NotificationProvider.getInstance().showNotification(
                'Data exported successfully',
                'info'
            );
        } catch (error) {
            NotificationProvider.getInstance().showNotification(
                'Failed to export data: ' + (error instanceof Error ? error.message : 'Unknown error'),
                'error'
            );
        }
    }

    private async importData() {
        try {
            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'All Files': ['*']
                }
            });

            if (!uri || uri.length === 0) return;

            const confirm = await vscode.window.showWarningMessage(
                'This will replace your current checklist. Are you sure?',
                { modal: true },
                'Yes'
            );

            if (confirm !== 'Yes') return;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Importing data...',
                cancellable: false
            }, async () => {
                await DataProvider.getInstance().importData(uri[0].fsPath);
                await AnalyticsProvider.getInstance().trackEvent('data.import');
            });

            NotificationProvider.getInstance().showNotification(
                'Data imported successfully',
                'info'
            );
        } catch (error) {
            NotificationProvider.getInstance().showNotification(
                'Failed to import data: ' + (error instanceof Error ? error.message : 'Unknown error'),
                'error'
            );
        }
    }

    private async selectTheme() {
        try {
            const themes = ThemeProvider.getInstance().getAvailableThemes();
            const currentTheme = ThemeProvider.getInstance().getCurrentTheme();

            const selected = await vscode.window.showQuickPick(
                themes.map(theme => ({
                    label: theme.name,
                    description: theme.name === currentTheme.name ? '(current)' : undefined
                })),
                { placeHolder: 'Select theme' }
            );

            if (!selected) return;

            await ThemeProvider.getInstance().setTheme(selected.label);
            await AnalyticsProvider.getInstance().trackEvent('theme.change', { theme: selected.label });

            NotificationProvider.getInstance().showNotification(
                'Theme updated successfully',
                'info'
            );
        } catch (error) {
            NotificationProvider.getInstance().showNotification(
                'Failed to change theme: ' + (error instanceof Error ? error.message : 'Unknown error'),
                'error'
            );
        }
    }

    private async showHelp() {
        const panel = vscode.window.createWebviewPanel(
            'implementationChecklistHelp',
            'Implementation Checklist Help',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = await this.getHelpContent();
        await AnalyticsProvider.getInstance().trackEvent('help.view');
    }

    private async getHelpContent(): Promise<string> {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Implementation Checklist Help</title>
                <style>
                    body { font-family: var(--vscode-font-family); padding: 20px; }
                    h1, h2 { color: var(--vscode-editor-foreground); }
                    .section { margin-bottom: 20px; }
                    .command { background: var(--vscode-editor-background); padding: 5px; margin: 5px 0; }
                </style>
            </head>
            <body>
                <h1>Implementation Checklist Help</h1>
                
                <div class="section">
                    <h2>Quick Actions</h2>
                    <div class="command">Quick Add (Ctrl+Shift+A)</div>
                    <div class="command">Quick Find (Ctrl+Shift+F)</div>
                    <div class="command">Quick Filter (Ctrl+Shift+L)</div>
                    <div class="command">Quick Stats (Ctrl+Shift+S)</div>
                </div>

                <div class="section">
                    <h2>Item Management</h2>
                    <div class="command">Toggle Status (Space)</div>
                    <div class="command">Set Priority (P)</div>
                    <div class="command">Add Note (N)</div>
                    <div class="command">Add Tag (T)</div>
                    <div class="command">Set Due Date (D)</div>
                </div>

                <div class="section">
                    <h2>Navigation</h2>
                    <div class="command">Move Up (Alt+Up)</div>
                    <div class="command">Move Down (Alt+Down)</div>
                    <div class="command">Move Out (Alt+Left)</div>
                    <div class="command">Move In (Alt+Right)</div>
                </div>

                <div class="section">
                    <h2>Data Management</h2>
                    <div class="command">Sync Workspace</div>
                    <div class="command">Create Backup</div>
                    <div class="command">Export Data</div>
                </div>

                <div class="section">
                    <h2>Need More Help?</h2>
                    <p>Visit our <a href="https://github.com/pasperfection/vscode-checklist">GitHub repository</a> for more information.</p>
                </div>
            </body>
            </html>
        `;
    }

    private async quickAdd() {
        try {
            const item = await vscode.window.showInputBox({
                prompt: 'Enter new checklist item',
                placeHolder: 'New item'
            });

            if (!item) return;

            await vscode.commands.executeCommand('implementation-checklist.addItem', { title: item });
            await AnalyticsProvider.getInstance().trackEvent('item.quickAdd');
        } catch (error) {
            NotificationProvider.getInstance().showNotification(
                'Failed to add item: ' + (error instanceof Error ? error.message : 'Unknown error'),
                'error'
            );
        }
    }

    private async quickFind() {
        try {
            const items = await vscode.commands.executeCommand<IChecklistItem[]>('implementation-checklist.getItems');
            if (!items) throw new Error('Failed to get items');

            const selected = await vscode.window.showQuickPick(
                items.map(item => ({
                    label: item.title,
                    description: item.tags?.join(', '),
                    detail: item.notes?.[0]?.text,
                    item
                })),
                { placeHolder: 'Search items' }
            );

            if (!selected) return;

            await vscode.commands.executeCommand('implementation-checklist.revealItem', selected.item);
            await AnalyticsProvider.getInstance().trackEvent('item.quickFind');
        } catch (error) {
            NotificationProvider.getInstance().showNotification(
                'Failed to find item: ' + (error instanceof Error ? error.message : 'Unknown error'),
                'error'
            );
        }
    }

    private async quickFilter() {
        try {
            const options = [
                { label: 'Priority', value: 'priority' },
                { label: 'Status', value: 'status' },
                { label: 'Due Date', value: 'dueDate' },
                { label: 'Tags', value: 'tags' }
            ];

            const selected = await vscode.window.showQuickPick(options, {
                placeHolder: 'Select filter type'
            });

            if (!selected) return;

            await vscode.commands.executeCommand('implementation-checklist.showFilterView', selected.value);
            await AnalyticsProvider.getInstance().trackEvent('filter.quick', { type: selected.value });
        } catch (error) {
            NotificationProvider.getInstance().showNotification(
                'Failed to show filter: ' + (error instanceof Error ? error.message : 'Unknown error'),
                'error'
            );
        }
    }

    private async quickStats() {
        try {
            await vscode.commands.executeCommand('implementation-checklist.showStatisticsView');
            await AnalyticsProvider.getInstance().trackEvent('stats.quick');
        } catch (error) {
            NotificationProvider.getInstance().showNotification(
                'Failed to show statistics: ' + (error instanceof Error ? error.message : 'Unknown error'),
                'error'
            );
        }
    }
}
