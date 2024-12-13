import * as vscode from 'vscode';

export type Priority = 'high' | 'medium' | 'low';
export type NotificationType = 'info' | 'warning' | 'error';
export type ExportFormat = 'json' | 'markdown' | 'csv';
export type ThemeName = 'default' | 'modern-dark' | 'modern-light' | 'ocean-dark';

export interface IChecklistItem {
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    priority?: Priority;
    dueDate?: string;
    notes?: INote[];
    tags?: string[];
    createdAt: string;
    updatedAt?: string;
    completedAt?: string;
    parent?: string;
    children?: string[];
    contextValue?: string;
    iconPath?: string | vscode.ThemeIcon;
    command?: vscode.Command;
}

export interface INote {
    id: string;
    text: string;
    createdAt: string;
    updatedAt?: string;
}

export interface IChecklistTemplate {
    id: string;
    name: string;
    description: string;
    items: IChecklistItem[];
    createdAt: string;
    updatedAt?: string;
    tags?: string[];
}

export interface IFilterOptions {
    priority?: Priority[];
    completed?: boolean;
    tags?: string[];
    dueDate?: {
        before?: string;
        after?: string;
    };
    search?: string;
    parent?: string;
}

export interface ISortOptions {
    by: 'priority' | 'dueDate' | 'completed' | 'title' | 'createdAt' | 'updatedAt';
    direction: 'asc' | 'desc';
}

export interface IStatistics {
    total: number;
    completed: number;
    overdue: number;
    dueSoon: number;
    byPriority: {
        high: number;
        medium: number;
        low: number;
        none: number;
    };
    byTag: { [key: string]: number };
    completionTrend: {
        date: string;
        completed: number;
        total: number;
    }[];
}

export interface ITheme {
    name: ThemeName;
    colors: {
        priorityHigh: string;
        priorityMedium: string;
        priorityLow: string;
        completed: string;
        pending: string;
        overdue: string;
        dueSoon: string;
        background: string;
        foreground: string;
        border: string;
        hover: string;
        selected: string;
    };
    icons: {
        completed: string;
        pending: string;
        expanded: string;
        collapsed: string;
        priority: string;
        date: string;
        tag: string;
        note: string;
    };
}

export interface IBackupMetadata {
    file: string;
    timestamp: string;
    itemCount: number;
    version: string;
}

export interface IAnalyticsEvent {
    eventName: string;
    timestamp: string;
    properties?: { [key: string]: any };
    anonymousId: string;
    sessionId?: string;
    workspaceId?: string;
    extensionVersion?: string;
    vscodeVersion?: string;
    platform?: string;
}

export interface IAnalyticsSummary {
    totalEvents: number;
    eventTypes: { [key: string]: number };
    dailyActivity: { [key: string]: number };
    topFeatures: { feature: string; count: number }[];
}

export interface ITreeItem extends vscode.TreeItem {
    children?: ITreeItem[];
    item?: IChecklistItem;
}

export interface ICommandRegistration {
    command: string;
    title: string;
    handler: (...args: any[]) => any;
    icon?: string;
    when?: string;
}
