import * as vscode from 'vscode';
import { IChecklistItem, IStatistics, Priority } from './types';
import { format, isAfter, isBefore, addDays, parseISO, startOfDay, endOfDay, eachDayOfInterval, subDays } from 'date-fns';

export class StatisticsProvider implements vscode.TreeDataProvider<StatisticsNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<StatisticsNode | undefined | null | void> = new vscode.EventEmitter<StatisticsNode | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<StatisticsNode | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private items: IChecklistItem[]) {}

    refresh(items: IChecklistItem[]): void {
        this.items = items;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: StatisticsNode): vscode.TreeItem {
        return element;
    }

    getChildren(element?: StatisticsNode): Thenable<StatisticsNode[]> {
        if (!element) {
            return Promise.resolve(this.getRootNodes());
        }
        return Promise.resolve(this.getChildNodes(element));
    }

    private getChildNodes(element: StatisticsNode): StatisticsNode[] {
        const stats = this.calculateStatistics();
        const nodes: StatisticsNode[] = [];

        switch (element.contextValue) {
            case 'priority':
                this.addPriorityDetailNodes(nodes, stats);
                break;
            case 'tags':
                this.addTagDetailNodes(nodes, stats);
                break;
            case 'trend':
                this.addTrendDetailNodes(nodes, stats);
                break;
        }

        return nodes;
    }

    private getRootNodes(): StatisticsNode[] {
        const stats = this.calculateStatistics();
        const nodes: StatisticsNode[] = [];

        // Overall Progress
        const progressPercentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
        nodes.push(new StatisticsNode(
            'Overall Progress',
            `${progressPercentage}% (${stats.completed}/${stats.total})`,
            'progress',
            vscode.TreeItemCollapsibleState.None
        ));

        // Priority Breakdown
        const priorityNode = new StatisticsNode(
            'Priority Breakdown',
            'Click to expand',
            'priority',
            vscode.TreeItemCollapsibleState.Collapsed
        );
        nodes.push(priorityNode);

        // Due Dates
        if (stats.overdue > 0) {
            nodes.push(new StatisticsNode(
                'Overdue Items',
                `${stats.overdue} items`,
                'overdue',
                vscode.TreeItemCollapsibleState.None,
                {
                    command: 'implementation-checklist.showOverdueItems',
                    title: 'Show Overdue Items',
                    arguments: []
                }
            ));
        }

        if (stats.dueSoon > 0) {
            nodes.push(new StatisticsNode(
                'Due Soon',
                `${stats.dueSoon} items due within 7 days`,
                'dueSoon',
                vscode.TreeItemCollapsibleState.None,
                {
                    command: 'implementation-checklist.showDueSoonItems',
                    title: 'Show Due Soon Items',
                    arguments: []
                }
            ));
        }

        // Tags
        const tagCount = Object.keys(stats.tags).length;
        if (tagCount > 0) {
            nodes.push(new StatisticsNode(
                'Tags',
                `${tagCount} tags used`,
                'tags',
                vscode.TreeItemCollapsibleState.Collapsed
            ));
        }

        // Completion Trend
        nodes.push(new StatisticsNode(
            'Completion Trend',
            'Last 7 days',
            'trend',
            vscode.TreeItemCollapsibleState.Collapsed
        ));

        return nodes;
    }

    private addPriorityDetailNodes(nodes: StatisticsNode[], stats: IStatistics): void {
        const priorities: Priority[] = ['high', 'medium', 'low'];
        priorities.forEach(priority => {
            const count = stats.byPriority[priority];
            if (count > 0) {
                nodes.push(new StatisticsNode(
                    `${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority`,
                    `${count} items`,
                    `priority-${priority}`,
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'implementation-checklist.showPriorityItems',
                        title: `Show ${priority} Priority Items`,
                        arguments: [priority]
                    }
                ));
            }
        });
    }

    private addTagDetailNodes(nodes: StatisticsNode[], stats: IStatistics): void {
        Object.entries(stats.tags)
            .sort(([, a], [, b]) => b - a)
            .forEach(([tag, count]) => {
                nodes.push(new StatisticsNode(
                    tag,
                    `${count} items`,
                    'tag',
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'implementation-checklist.showTaggedItems',
                        title: 'Show Tagged Items',
                        arguments: [tag]
                    }
                ));
            });
    }

    private addTrendDetailNodes(nodes: StatisticsNode[], stats: IStatistics): void {
        stats.completionTrend.forEach(({ date, completed, total }) => {
            const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
            nodes.push(new StatisticsNode(
                date,
                `${percentage}% (${completed}/${total})`,
                'trend-day',
                vscode.TreeItemCollapsibleState.None
            ));
        });
    }

    private calculateStatistics(): IStatistics {
        const now = new Date();
        const sevenDaysAgo = subDays(now, 7);

        const stats: IStatistics = {
            total: this.items.length,
            completed: 0,
            overdue: 0,
            dueSoon: 0,
            byPriority: {
                high: 0,
                medium: 0,
                low: 0,
                none: 0
            },
            tags: {},
            completionTrend: this.initializeCompletionTrend(sevenDaysAgo, now)
        };

        this.items.forEach(item => {
            // Count completed items
            if (item.completed) {
                stats.completed++;
            }

            // Count by priority
            if (item.priority) {
                stats.byPriority[item.priority]++;
            } else {
                stats.byPriority.none++;
            }

            // Process due dates
            if (item.dueDate && !item.completed) {
                const dueDate = parseISO(item.dueDate);
                if (isBefore(dueDate, startOfDay(now))) {
                    stats.overdue++;
                } else if (isBefore(dueDate, addDays(now, 7))) {
                    stats.dueSoon++;
                }
            }

            // Count tags
            item.tags?.forEach(tag => {
                stats.tags[tag] = (stats.tags[tag] || 0) + 1;
            });

            // Update completion trend
            if (item.completedAt) {
                const completedDate = parseISO(item.completedAt);
                if (isAfter(completedDate, sevenDaysAgo) && isBefore(completedDate, endOfDay(now))) {
                    const dateStr = format(completedDate, 'yyyy-MM-dd');
                    const trendDay = stats.completionTrend.find(t => t.date === dateStr);
                    if (trendDay) {
                        trendDay.completed++;
                    }
                }
            }
        });

        return stats;
    }

    private initializeCompletionTrend(startDate: Date, endDate: Date): Array<{ date: string; completed: number; total: number }> {
        return eachDayOfInterval({ start: startDate, end: endDate })
            .map(date => ({
                date: format(date, 'yyyy-MM-dd'),
                completed: 0,
                total: this.items.length
            }));
    }
}

class StatisticsNode extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly contextValue: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = `${label}: ${description}`;
        this.iconPath = this.getIconPath(contextValue);
    }

    private getIconPath(contextValue: string): { light: string; dark: string } | undefined {
        const iconName = this.getIconName(contextValue);
        if (!iconName) {
            return undefined;
        }

        return {
            light: `${__dirname}/../resources/light/${iconName}.svg`,
            dark: `${__dirname}/../resources/dark/${iconName}.svg`
        };
    }

    private getIconName(contextValue: string): string | undefined {
        switch (contextValue) {
            case 'progress': return 'chart';
            case 'priority': return 'list-ordered';
            case 'priority-high': return 'arrow-up';
            case 'priority-medium': return 'arrow-right';
            case 'priority-low': return 'arrow-down';
            case 'overdue': return 'alert';
            case 'dueSoon': return 'clock';
            case 'tags': return 'tag';
            case 'tag': return 'tag';
            case 'trend': return 'graph';
            case 'trend-day': return 'calendar';
            default: return undefined;
        }
    }
}
