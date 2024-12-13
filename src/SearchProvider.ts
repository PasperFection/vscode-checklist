import * as vscode from 'vscode';
import { IChecklistItem } from './types';

export class SearchProvider {
    constructor(private items: IChecklistItem[]) {}

    public async search(searchTerm: string): Promise<IChecklistItem[]> {
        if (!searchTerm) {
            return [];
        }

        const terms = searchTerm.toLowerCase().split(' ');
        return this.searchItems(this.items, terms);
    }

    private searchItems(items: IChecklistItem[], terms: string[]): IChecklistItem[] {
        const results: IChecklistItem[] = [];

        const searchItem = (item: IChecklistItem) => {
            if (this.itemMatchesTerms(item, terms)) {
                results.push(item);
            }

            if (item.children) {
                const childResults = this.searchItems(item.children, terms);
                results.push(...childResults);
            }
        };

        items.forEach(searchItem);
        return results;
    }

    private itemMatchesTerms(item: IChecklistItem, terms: string[]): boolean {
        const searchableText = [
            item.label.toLowerCase(),
            item.notes?.toLowerCase() || '',
            ...(item.tags || []).map(tag => tag.toLowerCase())
        ].join(' ');

        return terms.every(term => {
            // Support special search syntax
            if (term.includes(':')) {
                const [key, value] = term.split(':');
                switch (key) {
                    case 'priority':
                        return item.priority === value;
                    case 'status':
                        return item.status === (value === 'done' || value === 'true');
                    case 'tag':
                        return item.tags?.some(t => t.toLowerCase() === value);
                    case 'due':
                        if (!item.dueDate) return false;
                        const date = new Date(item.dueDate);
                        switch (value) {
                            case 'overdue':
                                return date < new Date();
                            case 'today':
                                const today = new Date();
                                return date.toDateString() === today.toDateString();
                            case 'week':
                                const weekFromNow = new Date();
                                weekFromNow.setDate(weekFromNow.getDate() + 7);
                                return date <= weekFromNow;
                            default:
                                return false;
                        }
                    default:
                        return searchableText.includes(term);
                }
            }

            return searchableText.includes(term);
        });
    }

    public getSearchHelpText(): string {
        return `Search Syntax:
• Simple text search: just type your search terms
• Priority: priority:high, priority:medium, priority:low
• Status: status:done, status:pending
• Tags: tag:important, tag:bug
• Due Date: due:overdue, due:today, due:week
• Combine terms with spaces for AND search

Examples:
• "bug priority:high" - High priority items with 'bug'
• "feature status:pending" - Pending feature items
• "due:today tag:important" - Important items due today`;
    }

    public showQuickPick(): void {
        const quickPick = vscode.window.createQuickPick();
        quickPick.placeholder = 'Search checklist items...';
        quickPick.items = [
            { label: '$(search) Search by text', description: 'Search items by text content' },
            { label: '$(tag) Search by tag', description: 'Search items by tag' },
            { label: '$(clock) Search by due date', description: 'Search items by due date' },
            { label: '$(list-ordered) Search by priority', description: 'Search items by priority level' }
        ];

        quickPick.onDidChangeValue(async value => {
            const results = await this.search(value);
            quickPick.items = results.map(item => ({
                label: item.label,
                description: this.getItemDescription(item)
            }));
        });

        quickPick.onDidAccept(() => {
            const selected = quickPick.selectedItems[0];
            if (selected) {
                vscode.commands.executeCommand('implementation-checklist.showItem', selected);
            }
            quickPick.hide();
        });

        quickPick.show();
    }

    private getItemDescription(item: IChecklistItem): string {
        const parts = [];
        if (item.priority) {
            parts.push(item.priority.toUpperCase());
        }
        if (item.dueDate) {
            parts.push(`Due: ${new Date(item.dueDate).toLocaleDateString()}`);
        }
        if (item.tags && item.tags.length > 0) {
            parts.push(`Tags: ${item.tags.join(', ')}`);
        }
        return parts.join(' | ');
    }
}
