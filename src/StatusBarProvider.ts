import * as vscode from 'vscode';
import { IChecklistItem } from './types';

export class StatusBarProvider {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.command = 'implementation-checklist.showStats';
    }

    public update(items: IChecklistItem[]) {
        const stats = this.calculateStats(items);
        const completionPercentage = Math.round((stats.completed / stats.total) * 100);
        
        this.statusBarItem.text = `$(checklist) ${completionPercentage}% Complete`;
        this.statusBarItem.tooltip = this.generateTooltip(stats);
        this.statusBarItem.show();
    }

    private calculateStats(items: IChecklistItem[]) {
        const stats = {
            total: 0,
            completed: 0,
            high: { total: 0, completed: 0 },
            medium: { total: 0, completed: 0 },
            low: { total: 0, completed: 0 },
            overdue: 0
        };

        const processItem = (item: IChecklistItem) => {
            stats.total++;
            if (item.status) {
                stats.completed++;
            }

            if (item.priority) {
                stats[item.priority].total++;
                if (item.status) {
                    stats[item.priority].completed++;
                }
            }

            if (item.dueDate && item.dueDate < new Date() && !item.status) {
                stats.overdue++;
            }

            if (item.children) {
                item.children.forEach(processItem);
            }
        };

        items.forEach(processItem);
        return stats;
    }

    private generateTooltip(stats: any) {
        return [
            `Total Progress: ${stats.completed}/${stats.total} items`,
            `High Priority: ${stats.high.completed}/${stats.high.total}`,
            `Medium Priority: ${stats.medium.completed}/${stats.medium.total}`,
            `Low Priority: ${stats.low.completed}/${stats.low.total}`,
            stats.overdue > 0 ? `⚠️ ${stats.overdue} overdue items` : ''
        ].filter(Boolean).join('\n');
    }

    public dispose() {
        this.statusBarItem.dispose();
    }
}
