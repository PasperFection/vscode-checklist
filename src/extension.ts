import * as vscode from 'vscode';
import * as path from 'path';

// Types en interfaces
interface IChecklistItem {
    label: string;
    children: ChecklistItem[];
    status: boolean;
    checkbox: string;
    command?: vscode.Command;
    contextValue?: string;
    tooltip?: string;
    priority?: 'high' | 'medium' | 'low';
    dueDate?: Date;
    notes?: string;
    tags?: string[];
}

type ItemType = 'file' | 'todo' | 'function' | 'interface' | 'class';

// Constants
const SUPPORTED_LANGUAGES = [
    'javascript', 'typescript', 'python', 'java', 'cpp', 'csharp'
];

const FILE_PATTERNS = {
    javascript: ['**/*.js', '**/*.jsx'],
    typescript: ['**/*.ts', '**/*.tsx'],
    python: ['**/*.py'],
    java: ['**/*.java'],
    cpp: ['**/*.cpp', '**/*.hpp', '**/*.h'],
    csharp: ['**/*.cs']
};

const EXCLUDE_PATTERNS = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**'
];

const PRIORITIES = {
    high: '🔴',
    medium: '🟡',
    low: '🟢'
};

const TEMPLATES = {
    typescript: [
        { label: 'Setup Project Structure', priority: 'high' },
        { label: 'Implement Core Features', priority: 'high' },
        { label: 'Add Unit Tests', priority: 'medium' },
        { label: 'Documentation', priority: 'medium' },
        { label: 'Code Review', priority: 'high' }
    ],
    react: [
        { label: 'Component Structure', priority: 'high' },
        { label: 'State Management', priority: 'high' },
        { label: 'Styling', priority: 'medium' },
        { label: 'Testing', priority: 'medium' },
        { label: 'Performance Optimization', priority: 'low' }
    ]
};

class ChecklistProvider implements vscode.TreeDataProvider<ChecklistItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ChecklistItem | undefined | null | void> = new vscode.EventEmitter<ChecklistItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ChecklistItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private items: ChecklistItem[] = [];
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ChecklistItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ChecklistItem): Thenable<ChecklistItem[]> {
        if (!element) {
            return Promise.resolve(this.items);
        }
        return Promise.resolve(element.children);
    }

    addItem(item: ChecklistItem): void {
        this.items.push(item);
        this.refresh();
    }

    clearItems(): void {
        this.items = [];
        this.refresh();
    }

    // Persistentie functies
    saveState(): void {
        const serializedItems = this.serializeItems(this.items);
        this.context.workspaceState.update('checklist-items', serializedItems);
    }

    loadState(): void {
        const savedItems = this.context.workspaceState.get<any[]>('checklist-items', []);
        this.items = this.deserializeItems(savedItems);
        this.refresh();
    }

    private serializeItems(items: ChecklistItem[]): any[] {
        return items.map(item => ({
            label: item.label.substring(2), // Verwijder checkbox prefix
            status: item.status,
            contextValue: item.contextValue,
            tooltip: item.tooltip,
            priority: item.priority,
            dueDate: item.dueDate?.toISOString(),
            notes: item.notes,
            tags: item.tags,
            children: this.serializeItems(item.children)
        }));
    }

    private deserializeItems(items: any[]): ChecklistItem[] {
        return items.map(item => {
            const checklistItem = new ChecklistItem(
                item.label,
                this.deserializeItems(item.children),
                item.status,
                item.priority,
                item.dueDate ? new Date(item.dueDate) : undefined,
                item.notes,
                item.tags
            );
            checklistItem.contextValue = item.contextValue;
            checklistItem.tooltip = item.tooltip;
            return checklistItem;
        });
    }
}

class ChecklistItem extends vscode.TreeItem implements IChecklistItem {
    public children: ChecklistItem[] = [];
    public status: boolean;
    public checkbox: string;
    public priority?: 'high' | 'medium' | 'low';
    public dueDate?: Date;
    public notes?: string;
    public tags: string[] = [];

    constructor(
        public readonly label: string,
        children: ChecklistItem[] = [],
        status: boolean = false,
        priority?: 'high' | 'medium' | 'low',
        dueDate?: Date,
        notes?: string,
        tags: string[] = []
    ) {
        super(
            label,
            children.length > 0
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.None
        );

        this.children = children;
        this.status = status;
        this.priority = priority;
        this.dueDate = dueDate;
        this.notes = notes;
        this.tags = tags;

        // Update label with priority and status
        const priorityIcon = priority ? PRIORITIES[priority] : '';
        this.checkbox = status ? '✓' : '☐';
        this.label = `${this.checkbox} ${priorityIcon} ${label}`;
        
        // Add tooltip with additional information
        this.tooltip = this.generateTooltip();

        if (children.length === 0) {
            this.command = {
                command: 'implementation-checklist.toggleItem',
                title: 'Toggle Item',
                arguments: [this]
            };
        }

        this.iconPath = this.getIconPath();
    }

    private generateTooltip(): string {
        const parts = [];
        if (this.priority) {
            parts.push(`Priority: ${this.priority}`);
        }
        if (this.dueDate) {
            parts.push(`Due: ${this.dueDate.toLocaleDateString()}`);
        }
        if (this.notes) {
            parts.push(`Notes: ${this.notes}`);
        }
        if (this.tags.length > 0) {
            parts.push(`Tags: ${this.tags.join(', ')}`);
        }
        return parts.join('\n');
    }

    private getIconPath(): { light: string; dark: string } | undefined {
        const iconName = this.getIconName();
        if (!iconName) return undefined;

        return {
            light: path.join(__filename, '..', '..', 'resources', 'light', `${iconName}.svg`),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', `${iconName}.svg`)
        };
    }

    private getIconName(): string | undefined {
        switch (this.contextValue) {
            case 'file': return 'file';
            case 'todo': return 'todo';
            case 'function': return 'function';
            case 'interface': return 'interface';
            case 'class': return 'class';
            default: return undefined;
        }
    }
}

async function scanWorkspace(): Promise<ChecklistItem[]> {
    const checklistItems: ChecklistItem[] = [];
    
    try {
        // Alle ondersteunde bestandspatronen verzamelen
        const patterns = Object.values(FILE_PATTERNS).flat();
        
        // Bestanden zoeken met de patterns
        const files = await vscode.workspace.findFiles(
            `{${patterns.join(',')}}`,
            `{${EXCLUDE_PATTERNS.join(',')}}`
        );
        
        for (const file of files) {
            const document = await vscode.workspace.openTextDocument(file);
            const text = document.getText();
            
            // Regex patterns voor verschillende items
            const patterns = {
                todos: /\/\/\s*(TODO|FIXME):.+/g,
                functions: /(?:function)\s+(\w+)/g,
                classes: /class\s+(\w+)/g,
                interfaces: /interface\s+(\w+)/g
            };
            
            const matches = {
                todos: text.match(patterns.todos) || [],
                functions: text.match(patterns.functions) || [],
                classes: text.match(patterns.classes) || [],
                interfaces: text.match(patterns.interfaces) || []
            };
            
            if (Object.values(matches).some(arr => arr.length > 0)) {
                const fileItem = new ChecklistItem(path.basename(file.fsPath), []);
                fileItem.contextValue = 'file';
                fileItem.tooltip = file.fsPath;
                
                // TODO's toevoegen
                matches.todos.forEach(todo => {
                    const todoItem = new ChecklistItem(
                        todo.replace(/\/\/\s*(TODO|FIXME):/, '').trim()
                    );
                    todoItem.contextValue = 'todo';
                    fileItem.children.push(todoItem);
                });
                
                // Functies toevoegen
                matches.functions.forEach(func => {
                    const funcName = func.split(' ')[1];
                    const funcItem = new ChecklistItem(`Implement ${funcName}`);
                    funcItem.contextValue = 'function';
                    fileItem.children.push(funcItem);
                });
                
                // Classes toevoegen
                matches.classes.forEach(cls => {
                    const className = cls.split(' ')[1];
                    const classItem = new ChecklistItem(`Implement ${className}`);
                    classItem.contextValue = 'class';
                    fileItem.children.push(classItem);
                });
                
                // Interfaces toevoegen
                matches.interfaces.forEach(intf => {
                    const intfName = intf.split(' ')[1];
                    const intfItem = new ChecklistItem(`Implement ${intfName}`);
                    intfItem.contextValue = 'interface';
                    fileItem.children.push(intfItem);
                });
                
                checklistItems.push(fileItem);
            }
        }
    } catch (error) {
        console.error('Error scanning workspace:', error);
        vscode.window.showErrorMessage('Error scanning workspace: ' + (error as Error).message);
    }
    
    return checklistItems;
}

let statusBarItem: vscode.StatusBarItem;
let checklistItems: any[] = [];

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    console.log('Implementation Checklist is now active');

    // Initialize providers
    const notificationProvider = new NotificationProvider();
    const statisticsProvider = new StatisticsProvider();
    const contextMenuProvider = new ContextMenuProvider();
    const keyboardHandler = new KeyboardShortcutHandler();
    const workspaceProvider = new WorkspaceProvider();
    const backupProvider = new BackupProvider();
    const commandPaletteProvider = new CommandPaletteProvider();
    const analyticsProvider = new AnalyticsProvider();
    const themeProvider = new ThemeProvider();
    const helpProvider = new HelpProvider(context.extensionUri);
    const dataProvider = new DataProvider();

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBarItem.command = 'implementation-checklist.showStatistics';
    context.subscriptions.push(statusBarItem);

    // Load initial data
    try {
        checklistItems = await workspaceProvider.loadFromWorkspace();
        updateStatusBar();
        notificationProvider.showNotification('Checklist loaded successfully', 'info');
    } catch (error) {
        notificationProvider.showNotification('Failed to load checklist', 'error');
    }

    // Register tree data providers
    vscode.window.registerTreeDataProvider('implementationChecklist', statisticsProvider);
    vscode.window.registerTreeDataProvider('implementationChecklistHelp', helpProvider);

    // Register commands
    const commands = [
        ['implementation-checklist.createItem', createItem],
        ['implementation-checklist.editItem', editItem],
        ['implementation-checklist.deleteItem', deleteItem],
        ['implementation-checklist.toggleComplete', toggleComplete],
        ['implementation-checklist.setPriority', setPriority],
        ['implementation-checklist.setDueDate', setDueDate],
        ['implementation-checklist.addNote', addNote],
        ['implementation-checklist.addTag', addTag],
        ['implementation-checklist.showStatistics', showStatistics],
        ['implementation-checklist.filterItems', filterItems],
        ['implementation-checklist.sortItems', sortItems],
        ['implementation-checklist.searchItems', searchItems],
        ['implementation-checklist.syncWorkspace', syncWorkspace],
        ['implementation-checklist.syncWithRemote', syncWithRemote],
        ['implementation-checklist.createBackup', createBackup],
        ['implementation-checklist.restoreBackup', restoreBackup],
        ['implementation-checklist.exportBackups', exportBackups],
        ['implementation-checklist.importBackups', importBackups],
        ['implementation-checklist.exportData', exportData],
        ['implementation-checklist.importData', importData],
        ['implementation-checklist.selectTheme', selectTheme],
        ['implementation-checklist.showHelp', showHelp],
        ['implementation-checklist.getItems', () => checklistItems],
        ['implementation-checklist.updateItems', updateItems]
    ];

    commands.forEach(([command, handler]) => {
        context.subscriptions.push(
            vscode.commands.registerCommand(command, handler)
        );
    });

    // Setup workspace file watcher
    if (vscode.workspace.workspaceFolders) {
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(
                vscode.workspace.workspaceFolders[0],
                '**/.implementation-checklist.json'
            )
        );

        watcher.onDidChange(async () => {
            try {
                checklistItems = await workspaceProvider.loadFromWorkspace();
                updateStatusBar();
                notificationProvider.showNotification('Checklist synchronized', 'info');
            } catch (error) {
                notificationProvider.showNotification('Failed to sync checklist', 'error');
            }
        });

        context.subscriptions.push(watcher);
    }

    // Setup auto-backup
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async () => {
            if (vscode.workspace.getConfiguration('implementation-checklist').get('autoBackup')) {
                await backupProvider.autoBackup(checklistItems);
            }
        })
    );

    // Track activation
    analyticsProvider.trackEvent('extension_activated');
}

// Command handlers
async function createItem() {
    const title = await vscode.window.showInputBox({
        prompt: 'Enter checklist item title'
    });

    if (title) {
        const item = {
            id: Date.now().toString(),
            title,
            completed: false,
            createdAt: new Date().toISOString()
        };

        checklistItems.push(item);
        await saveChanges();
        AnalyticsProvider.getInstance().trackEvent('item_created');
    }
}

async function editItem() {
    const item = await selectItem('Select item to edit');
    if (item) {
        const newTitle = await vscode.window.showInputBox({
            prompt: 'Enter new title',
            value: item.title
        });

        if (newTitle) {
            item.title = newTitle;
            await saveChanges();
            AnalyticsProvider.getInstance().trackEvent('item_edited');
        }
    }
}

async function deleteItem() {
    const item = await selectItem('Select item to delete');
    if (item) {
        const index = checklistItems.indexOf(item);
        checklistItems.splice(index, 1);
        await saveChanges();
        AnalyticsProvider.getInstance().trackEvent('item_deleted');
    }
}

async function toggleComplete() {
    const item = await selectItem('Select item to toggle');
    if (item) {
        item.completed = !item.completed;
        await saveChanges();
        AnalyticsProvider.getInstance().trackEvent('item_toggled');
    }
}

async function setPriority() {
    const item = await selectItem('Select item to set priority');
    if (item) {
        const priority = await vscode.window.showQuickPick(
            ['High', 'Medium', 'Low'],
            { placeHolder: 'Select priority' }
        );

        if (priority) {
            item.priority = priority.toLowerCase();
            await saveChanges();
            AnalyticsProvider.getInstance().trackEvent('priority_set');
        }
    }
}

async function setDueDate() {
    const item = await selectItem('Select item to set due date');
    if (item) {
        const dueDate = await vscode.window.showInputBox({
            prompt: 'Enter due date (YYYY-MM-DD)',
            validateInput: validateDate
        });

        if (dueDate) {
            item.dueDate = dueDate;
            await saveChanges();
            AnalyticsProvider.getInstance().trackEvent('due_date_set');
        }
    }
}

async function addNote() {
    const item = await selectItem('Select item to add note');
    if (item) {
        const note = await vscode.window.showInputBox({
            prompt: 'Enter note'
        });

        if (note) {
            item.notes = item.notes || [];
            item.notes.push({
                text: note,
                createdAt: new Date().toISOString()
            });
            await saveChanges();
            AnalyticsProvider.getInstance().trackEvent('note_added');
        }
    }
}

async function addTag() {
    const item = await selectItem('Select item to add tag');
    if (item) {
        const tag = await vscode.window.showInputBox({
            prompt: 'Enter tag'
        });

        if (tag) {
            item.tags = item.tags || [];
            item.tags.push(tag);
            await saveChanges();
            AnalyticsProvider.getInstance().trackEvent('tag_added');
        }
    }
}

async function showStatistics() {
    StatisticsProvider.getInstance().showStatisticsView();
    AnalyticsProvider.getInstance().trackEvent('statistics_viewed');
}

async function filterItems() {
    const filter = await vscode.window.showQuickPick(
        ['All', 'Completed', 'Pending', 'High Priority', 'Due Soon'],
        { placeHolder: 'Select filter' }
    );

    if (filter) {
        // Apply filter logic
        AnalyticsProvider.getInstance().trackEvent('items_filtered');
    }
}

async function sortItems() {
    const sortBy = await vscode.window.showQuickPick(
        ['Due Date', 'Priority', 'Created Date', 'Title'],
        { placeHolder: 'Sort by' }
    );

    if (sortBy) {
        // Apply sort logic
        AnalyticsProvider.getInstance().trackEvent('items_sorted');
    }
}

async function searchItems() {
    const searchTerm = await vscode.window.showInputBox({
        prompt: 'Search items'
    });

    if (searchTerm) {
        // Apply search logic
        AnalyticsProvider.getInstance().trackEvent('items_searched');
    }
}

async function syncWorkspace() {
    await WorkspaceProvider.getInstance().saveToWorkspace(checklistItems);
    AnalyticsProvider.getInstance().trackEvent('workspace_synced');
}

async function syncWithRemote() {
    await WorkspaceProvider.getInstance().syncWithRemote();
    AnalyticsProvider.getInstance().trackEvent('remote_synced');
}

async function createBackup() {
    await BackupProvider.getInstance().createBackup(checklistItems);
    AnalyticsProvider.getInstance().trackEvent('backup_created');
}

async function restoreBackup() {
    const backups = await BackupProvider.getInstance().listBackups();
    const selected = await vscode.window.showQuickPick(
        backups.map(b => ({
            label: new Date(b.timestamp).toLocaleString(),
            backup: b
        }))
    );

    if (selected) {
        checklistItems = await BackupProvider.getInstance().restoreBackup(selected.backup.file);
        await saveChanges();
        AnalyticsProvider.getInstance().trackEvent('backup_restored');
    }
}

async function exportBackups() {
    const uri = await vscode.window.showSaveDialog({
        filters: { 'JSON Files': ['json'] }
    });

    if (uri) {
        await BackupProvider.getInstance().exportBackups(uri.fsPath);
        AnalyticsProvider.getInstance().trackEvent('backups_exported');
    }
}

async function importBackups() {
    const uri = await vscode.window.showOpenDialog({
        filters: { 'JSON Files': ['json'] }
    });

    if (uri && uri[0]) {
        await BackupProvider.getInstance().importBackups(uri[0].fsPath);
        AnalyticsProvider.getInstance().trackEvent('backups_imported');
    }
}

async function exportData() {
    const format = await vscode.window.showQuickPick(
        ['JSON', 'Markdown', 'CSV'],
        { placeHolder: 'Select export format' }
    );

    if (format) {
        const uri = await vscode.window.showSaveDialog({
            filters: {
                'JSON Files': ['json'],
                'Markdown Files': ['md'],
                'CSV Files': ['csv']
            }
        });

        if (uri) {
            await DataProvider.getInstance().exportData(
                checklistItems,
                uri.fsPath,
                format.toLowerCase() as 'json' | 'markdown' | 'csv'
            );
            AnalyticsProvider.getInstance().trackEvent('data_exported');
        }
    }
}

async function importData() {
    const uri = await vscode.window.showOpenDialog({
        filters: {
            'All Supported Files': ['json', 'md', 'csv']
        }
    });

    if (uri && uri[0]) {
        const format = uri[0].path.split('.').pop() as 'json' | 'markdown' | 'csv';
        checklistItems = await DataProvider.getInstance().importData(
            uri[0].fsPath,
            format
        );
        await saveChanges();
        AnalyticsProvider.getInstance().trackEvent('data_imported');
    }
}

async function selectTheme() {
    const themes = ThemeProvider.getInstance().getAvailableThemes();
    const selected = await vscode.window.showQuickPick(themes, {
        placeHolder: 'Select theme'
    });

    if (selected) {
        ThemeProvider.getInstance().setTheme(selected);
        AnalyticsProvider.getInstance().trackEvent('theme_changed');
    }
}

function showHelp() {
    vscode.commands.executeCommand('implementation-checklist.showHelpTopic', 'getting-started');
    AnalyticsProvider.getInstance().trackEvent('help_viewed');
}

// Helper functions
async function selectItem(prompt: string) {
    const items = checklistItems.map(item => ({
        label: item.title,
        description: item.completed ? 'Completed' : 'Pending',
        item
    }));

    const selected = await vscode.window.showQuickPick(items, { placeHolder: prompt });
    return selected?.item;
}

function validateDate(input: string): string | undefined {
    const date = new Date(input);
    return isNaN(date.getTime()) ? 'Invalid date format' : undefined;
}

async function saveChanges() {
    await WorkspaceProvider.getInstance().saveToWorkspace(checklistItems);
    updateStatusBar();
}

function updateStatusBar() {
    const total = checklistItems.length;
    const completed = checklistItems.filter(item => item.completed).length;
    statusBarItem.text = `$(checklist) ${completed}/${total} completed`;
    statusBarItem.show();
}

async function updateItems(items: any[]) {
    checklistItems = items;
    await saveChanges();
}

export function deactivate(): void {
    // Clean up resources
    statusBarItem.dispose();
}
