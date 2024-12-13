import * as vscode from 'vscode';
import { format } from 'date-fns';

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
}
