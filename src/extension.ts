import * as vscode from 'vscode';
import * as path from 'path';
import { ThemeProvider } from './ThemeProvider';
import { NotificationProvider } from './NotificationProvider';
import { AnalyticsProvider } from './AnalyticsProvider';

// Types and interfaces
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
        this.loadState();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
        this.saveState();
        updateStatusBar();
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
        AnalyticsProvider.getInstance().trackEvent('item.add');
    }

    removeItem(item: ChecklistItem): void {
        const index = this.items.indexOf(item);
        if (index > -1) {
            this.items.splice(index, 1);
            this.refresh();
            AnalyticsProvider.getInstance().trackEvent('item.remove');
        }
    }

    clearItems(): void {
        this.items = [];
        this.refresh();
    }

    saveState(): void {
        this.context.globalState.update('checklistItems', this.serializeItems(this.items));
    }

    loadState(): void {
        const savedItems = this.context.globalState.get<any[]>('checklistItems', []);
        this.items = this.deserializeItems(savedItems);
        this.refresh();
    }

    private serializeItems(items: ChecklistItem[]): any[] {
        return items.map(item => ({
            label: item.label,
            status: item.status,
            priority: item.priority,
            dueDate: item.dueDate?.toISOString(),
            notes: item.notes,
            tags: item.tags,
            children: this.serializeItems(item.children)
        }));
    }

    private deserializeItems(items: any[]): ChecklistItem[] {
        return items.map(item => new ChecklistItem(
            item.label,
            this.deserializeItems(item.children || []),
            item.status,
            item.priority,
            item.dueDate ? new Date(item.dueDate) : undefined,
            item.notes,
            item.tags || []
        ));
    }

    createItem(label: string): ChecklistItem {
        const item = new ChecklistItem(label);
        this.addItem(item);
        return item;
    }

    editItem(item: ChecklistItem, newLabel: string): void {
        item.label = newLabel;
        this.refresh();
    }

    deleteItem(item: ChecklistItem): void {
        this.removeItem(item);
    }

    toggleComplete(item: ChecklistItem): void {
        item.status = !item.status;
        this.refresh();
    }

    setPriority(item: ChecklistItem, priority: 'high' | 'medium' | 'low'): void {
        item.priority = priority;
        this.refresh();
    }

    setDueDate(item: ChecklistItem, dueDate: Date): void {
        item.dueDate = dueDate;
        this.refresh();
    }

    addNote(item: ChecklistItem, note: string): void {
        item.notes = note;
        this.refresh();
    }

    addTag(item: ChecklistItem, tag: string): void {
        item.tags.push(tag);
        this.refresh();
    }

    filterItems(filter: (item: ChecklistItem) => boolean): void {
        this.items = this.items.filter(filter);
        this.refresh();
    }

    sortItems(compare: (a: ChecklistItem, b: ChecklistItem) => number): void {
        this.items.sort(compare);
        this.refresh();
    }

    async scanWorkspace(): Promise<void> {
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
                    
                    this.addItem(fileItem);
                }
            }
        } catch (error) {
            console.error('Error scanning workspace:', error);
            vscode.window.showErrorMessage('Error scanning workspace: ' + (error as Error).message);
        }
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

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    try {
        // Initialize providers
        const checklistProvider = new ChecklistProvider(context);
        const themeProvider = ThemeProvider.getInstance();
        const notificationProvider = NotificationProvider.getInstance();
        const analyticsProvider = AnalyticsProvider.getInstance();

        // Initialize theme
        themeProvider.initialize(context);

        // Create tree view
        const treeView = vscode.window.createTreeView('implementationChecklist', {
            treeDataProvider: checklistProvider,
            showCollapseAll: true,
            canSelectMany: false
        });

        // Create status bar
        let statusBarItem: vscode.StatusBarItem;
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        statusBarItem.text = "$(checklist) Implementation Checklist";
        statusBarItem.command = 'implementation-checklist.showMenu';
        statusBarItem.show();

        // Register commands
        const commands = [
            vscode.commands.registerCommand('implementation-checklist.scanWorkspace', () => {
                checklistProvider.scanWorkspace();
            }),
            
            vscode.commands.registerCommand('implementation-checklist.refreshView', () => {
                checklistProvider.refresh();
                analyticsProvider.trackEvent('view.refresh');
            }),

            vscode.commands.registerCommand('implementation-checklist.createItem', async () => {
                const label = await vscode.window.showInputBox({
                    prompt: 'Enter checklist item',
                    placeHolder: 'What needs to be done?'
                });
                if (label) {
                    checklistProvider.createItem(label);
                }
            }),

            vscode.commands.registerCommand('implementation-checklist.editItem', async (item: ChecklistItem) => {
                const newLabel = await vscode.window.showInputBox({
                    prompt: 'Edit checklist item',
                    value: item.label
                });
                if (newLabel) {
                    checklistProvider.editItem(item, newLabel);
                }
            }),

            vscode.commands.registerCommand('implementation-checklist.deleteItem', async (item: ChecklistItem) => {
                const confirm = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete "${item.label}"?`,
                    { modal: true },
                    'Delete'
                );
                if (confirm === 'Delete') {
                    checklistProvider.deleteItem(item);
                }
            }),

            vscode.commands.registerCommand('implementation-checklist.toggleComplete', (item: ChecklistItem) => {
                checklistProvider.toggleComplete(item);
            }),

            vscode.commands.registerCommand('implementation-checklist.setPriority', async (item: ChecklistItem) => {
                const priority = await vscode.window.showQuickPick(
                    ['high', 'medium', 'low'],
                    {
                        placeHolder: 'Select priority'
                    }
                ) as 'high' | 'medium' | 'low' | undefined;
                
                if (priority) {
                    checklistProvider.setPriority(item, priority);
                }
            }),

            vscode.commands.registerCommand('implementation-checklist.setDueDate', async (item: ChecklistItem) => {
                const dateString = await vscode.window.showInputBox({
                    prompt: 'Enter due date (YYYY-MM-DD)',
                    placeHolder: 'YYYY-MM-DD'
                });
                
                if (dateString) {
                    const date = new Date(dateString);
                    if (!isNaN(date.getTime())) {
                        checklistProvider.setDueDate(item, date);
                    } else {
                        vscode.window.showErrorMessage('Invalid date format. Please use YYYY-MM-DD');
                    }
                }
            }),

            vscode.commands.registerCommand('implementation-checklist.addNote', async (item: ChecklistItem) => {
                const note = await vscode.window.showInputBox({
                    prompt: 'Add a note',
                    placeHolder: 'Enter note text'
                });
                
                if (note) {
                    checklistProvider.addNote(item, note);
                }
            }),

            vscode.commands.registerCommand('implementation-checklist.addTag', async (item: ChecklistItem) => {
                const tag = await vscode.window.showInputBox({
                    prompt: 'Add a tag',
                    placeHolder: 'Enter tag (without #)'
                });
                
                if (tag) {
                    checklistProvider.addTag(item, tag);
                }
            }),

            vscode.commands.registerCommand('implementation-checklist.showStatistics', () => {
                // TODO: Implement statistics view
                vscode.window.showInformationMessage('Statistics feature coming soon!');
            }),

            vscode.commands.registerCommand('implementation-checklist.filterItems', async () => {
                const filter = await vscode.window.showQuickPick(
                    ['All', 'Active', 'Completed'],
                    {
                        placeHolder: 'Filter items'
                    }
                );
                
                if (filter) {
                    switch (filter) {
                        case 'Active':
                            checklistProvider.filterItems(item => !item.status);
                            break;
                        case 'Completed':
                            checklistProvider.filterItems(item => item.status);
                            break;
                        default:
                            checklistProvider.refresh();
                    }
                }
            }),

            vscode.commands.registerCommand('implementation-checklist.sortItems', async () => {
                const sortBy = await vscode.window.showQuickPick(
                    ['Priority', 'Due Date', 'Alphabetical'],
                    {
                        placeHolder: 'Sort by'
                    }
                );
                
                if (sortBy) {
                    switch (sortBy) {
                        case 'Priority':
                            checklistProvider.sortItems((a, b) => {
                                const priority = { high: 0, medium: 1, low: 2 };
                                return priority[a.priority] - priority[b.priority];
                            });
                            break;
                        case 'Due Date':
                            checklistProvider.sortItems((a, b) => {
                                if (!a.dueDate) return 1;
                                if (!b.dueDate) return -1;
                                return a.dueDate.getTime() - b.dueDate.getTime();
                            });
                            break;
                        case 'Alphabetical':
                            checklistProvider.sortItems((a, b) => a.label.localeCompare(b.label));
                            break;
                    }
                }
            })
        ];

        context.subscriptions.push(...commands, treeView, statusBarItem);

        // Auto-scan on startup if enabled
        const config = vscode.workspace.getConfiguration('implementation-checklist');
        if (config.get<boolean>('scanOnStartup', true)) {
            vscode.commands.executeCommand('implementation-checklist.scanWorkspace');
        }

        analyticsProvider.trackEvent('extension.activate');
    } catch (error) {
        NotificationProvider.getInstance().showNotification(
            'Failed to activate extension: ' + (error instanceof Error ? error.message : 'Unknown error'),
            'error'
        );
        throw error;
    }
}

// ... rest of the code remains the same ...
