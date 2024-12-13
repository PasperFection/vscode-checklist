import * as vscode from 'vscode';
import { IChecklistItem } from './types';

export class NotificationProvider {
    private static instance: NotificationProvider;
    private notificationQueue: Array<() => Promise<void>> = [];
    private isProcessing = false;

    private constructor() {
        // Initialize notification check interval
        setInterval(() => this.checkDueDates(), 1000 * 60 * 60); // Check every hour
    }

    public static getInstance(): NotificationProvider {
        if (!NotificationProvider.instance) {
            NotificationProvider.instance = new NotificationProvider();
        }
        return NotificationProvider.instance;
    }

    public async showNotification(
        message: string,
        type: 'info' | 'warning' | 'error' = 'info',
        ...actions: string[]
    ): Promise<string | undefined> {
        return new Promise((resolve) => {
            this.notificationQueue.push(async () => {
                let result: string | undefined;
                switch (type) {
                    case 'info':
                        result = await this.showInfoNotification(message, ...actions);
                        break;
                    case 'warning':
                        result = await this.showWarningNotification(message, ...actions);
                        break;
                    case 'error':
                        result = await this.showErrorNotification(message, ...actions);
                        break;
                }
                resolve(result);
            });
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.isProcessing || this.notificationQueue.length === 0) {
            return;
        }

        this.isProcessing = true;
        const notification = this.notificationQueue.shift();
        if (notification) {
            await notification();
        }
        this.isProcessing = false;
        this.processQueue();
    }

    private async showInfoNotification(message: string, ...actions: string[]): Promise<string | undefined> {
        return vscode.window.showInformationMessage(message, ...actions);
    }

    private async showWarningNotification(message: string, ...actions: string[]): Promise<string | undefined> {
        return vscode.window.showWarningMessage(message, ...actions);
    }

    private async showErrorNotification(message: string, ...actions: string[]): Promise<string | undefined> {
        return vscode.window.showErrorMessage(message, ...actions);
    }

    public async checkDueDates() {
        const items = await vscode.commands.executeCommand<IChecklistItem[]>('implementation-checklist.getItems');
        if (!items) return;

        const now = new Date();
        const overdueItems: IChecklistItem[] = [];
        const dueSoonItems: IChecklistItem[] = [];

        const checkItem = (item: IChecklistItem) => {
            if (!item.status && item.dueDate) {
                const dueDate = new Date(item.dueDate);
                if (dueDate < now) {
                    overdueItems.push(item);
                } else {
                    const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
                    if (hoursUntilDue <= 24) {
                        dueSoonItems.push(item);
                    }
                }
            }

            if (item.children) {
                item.children.forEach(checkItem);
            }
        };

        items.forEach(checkItem);

        if (overdueItems.length > 0) {
            const result = await this.showNotification(
                `You have ${overdueItems.length} overdue items`,
                'warning',
                'View Items',
                'Dismiss'
            );
            if (result === 'View Items') {
                vscode.commands.executeCommand('implementation-checklist.showOverdueItems');
            }
        }

        if (dueSoonItems.length > 0) {
            const result = await this.showNotification(
                `You have ${dueSoonItems.length} items due within 24 hours`,
                'info',
                'View Items',
                'Dismiss'
            );
            if (result === 'View Items') {
                vscode.commands.executeCommand('implementation-checklist.showDueSoonItems');
            }
        }
    }

    public async showProgressNotification(
        title: string,
        totalSteps: number,
        cancellable = false
    ): Promise<vscode.Progress<{ message?: string; increment?: number }>> {
        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title,
                cancellable
            },
            async (progress) => {
                return new Promise<vscode.Progress<{ message?: string; increment?: number }>>(
                    (resolve) => resolve(progress)
                );
            }
        );
    }

    public async showStatusBarProgress(
        title: string,
        totalSteps: number
    ): Promise<vscode.Progress<{ message?: string; increment?: number }>> {
        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Window,
                title
            },
            async (progress) => {
                return new Promise<vscode.Progress<{ message?: string; increment?: number }>>(
                    (resolve) => resolve(progress)
                );
            }
        );
    }
}
