import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { IChecklistItem } from './types';

export class DataProvider {
    private static instance: DataProvider;
    private readonly storageFile: string;

    private constructor(context: vscode.ExtensionContext) {
        this.storageFile = path.join(context.globalStorageUri.fsPath, 'checklist-data.json');
    }

    public static getInstance(context: vscode.ExtensionContext): DataProvider {
        if (!DataProvider.instance) {
            DataProvider.instance = new DataProvider(context);
        }
        return DataProvider.instance;
    }

    public async exportData(format: 'json' | 'markdown' | 'csv' = 'json'): Promise<string> {
        const items = await vscode.commands.executeCommand<IChecklistItem[]>('implementation-checklist.getItems');
        if (!items) {
            throw new Error('Failed to get checklist items');
        }

        switch (format) {
            case 'json':
                return this.exportToJSON(items);
            case 'markdown':
                return this.exportToMarkdown(items);
            case 'csv':
                return this.exportToCSV(items);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    public async importData(data: string, format: 'json' | 'markdown' | 'csv' = 'json'): Promise<IChecklistItem[]> {
        switch (format) {
            case 'json':
                return this.importFromJSON(data);
            case 'markdown':
                return this.importFromMarkdown(data);
            case 'csv':
                return this.importFromCSV(data);
            default:
                throw new Error(`Unsupported import format: ${format}`);
        }
    }

    private exportToJSON(items: IChecklistItem[]): string {
        return JSON.stringify(items, null, 2);
    }

    private exportToMarkdown(items: IChecklistItem[]): string {
        let markdown = '# Implementation Checklist\n\n';

        const formatItem = (item: IChecklistItem, level: number = 0): string => {
            const indent = '  '.repeat(level);
            const checkbox = item.status ? '[x]' : '[ ]';
            const priority = item.priority ? `[${item.priority.toUpperCase()}]` : '';
            const dueDate = item.dueDate ? `(Due: ${new Date(item.dueDate).toLocaleDateString()})` : '';
            const tags = item.tags?.length ? `Tags: ${item.tags.join(', ')}` : '';
            
            let md = `${indent}- ${checkbox} ${priority} ${item.label} ${dueDate} ${tags}\n`;
            if (item.notes) {
                md += `${indent}  > ${item.notes}\n`;
            }
            
            if (item.children) {
                md += item.children.map(child => formatItem(child, level + 1)).join('');
            }
            
            return md;
        };

        markdown += items.map(item => formatItem(item)).join('');
        return markdown;
    }

    private exportToCSV(items: IChecklistItem[]): string {
        const headers = ['Label', 'Status', 'Priority', 'Due Date', 'Tags', 'Notes', 'Parent'];
        let csv = headers.join(',') + '\n';

        const formatValue = (value: string): string => {
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        };

        const processItem = (item: IChecklistItem, parent: string = '') => {
            const row = [
                formatValue(item.label),
                item.status ? 'Complete' : 'Pending',
                item.priority || '',
                item.dueDate ? new Date(item.dueDate).toISOString() : '',
                item.tags ? item.tags.join(';') : '',
                item.notes ? formatValue(item.notes) : '',
                formatValue(parent)
            ];
            csv += row.join(',') + '\n';

            if (item.children) {
                item.children.forEach(child => processItem(child, item.label));
            }
        };

        items.forEach(item => processItem(item));
        return csv;
    }

    private importFromJSON(data: string): IChecklistItem[] {
        try {
            return JSON.parse(data);
        } catch (error) {
            throw new Error('Invalid JSON format');
        }
    }

    private importFromMarkdown(data: string): IChecklistItem[] {
        const items: IChecklistItem[] = [];
        const lines = data.split('\n');
        const stack: { item: IChecklistItem; level: number }[] = [];

        lines.forEach(line => {
            if (!line.trim() || line.startsWith('#')) return;

            const match = line.match(/^(\s*)- \[(x| )\] (?:\[(\w+)\] )?(.+?)(?:\(Due: (.+?)\))?(?:Tags: (.+?))?$/i);
            if (!match) return;

            const [, indent, status, priority, label, dueDate, tags] = match;
            const level = indent.length / 2;

            const item: IChecklistItem = {
                label: label.trim(),
                status: status === 'x',
                priority: priority?.toLowerCase() as any,
                dueDate: dueDate ? new Date(dueDate) : undefined,
                tags: tags ? tags.split(',').map(t => t.trim()) : undefined,
                children: []
            };

            while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                stack.pop();
            }

            if (stack.length === 0) {
                items.push(item);
            } else {
                stack[stack.length - 1].item.children?.push(item);
            }

            stack.push({ item, level });
        });

        return items;
    }

    private importFromCSV(data: string): IChecklistItem[] {
        const lines = data.split('\n');
        const headers = lines[0].toLowerCase().split(',');
        const items: IChecklistItem[] = [];
        const itemMap = new Map<string, IChecklistItem>();

        lines.slice(1).forEach(line => {
            if (!line.trim()) return;

            const values = this.parseCSVLine(line);
            const item: IChecklistItem = {
                label: values[headers.indexOf('label')],
                status: values[headers.indexOf('status')].toLowerCase() === 'complete',
                priority: values[headers.indexOf('priority')] as any,
                dueDate: values[headers.indexOf('due date')] ? new Date(values[headers.indexOf('due date')]) : undefined,
                tags: values[headers.indexOf('tags')] ? values[headers.indexOf('tags')].split(';') : undefined,
                notes: values[headers.indexOf('notes')],
                children: []
            };

            const parent = values[headers.indexOf('parent')];
            if (parent) {
                const parentItem = itemMap.get(parent);
                if (parentItem) {
                    parentItem.children?.push(item);
                }
            } else {
                items.push(item);
            }

            itemMap.set(item.label, item);
        });

        return items;
    }

    private parseCSVLine(line: string): string[] {
        const values: string[] = [];
        let currentValue = '';
        let insideQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    currentValue += '"';
                    i++;
                } else {
                    insideQuotes = !insideQuotes;
                }
            } else if (char === ',' && !insideQuotes) {
                values.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue.trim());
        return values;
    }

    public async saveToFile(items: IChecklistItem[]): Promise<void> {
        const data = JSON.stringify(items, null, 2);
        await fs.promises.mkdir(path.dirname(this.storageFile), { recursive: true });
        await fs.promises.writeFile(this.storageFile, data, 'utf8');
    }

    public async loadFromFile(): Promise<IChecklistItem[]> {
        try {
            const data = await fs.promises.readFile(this.storageFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return [];
        }
    }
}
