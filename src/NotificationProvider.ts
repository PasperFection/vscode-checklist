import * as vscode from 'vscode';
import { IChecklistItem, NotificationType } from './types';
import { AnalyticsProvider } from './AnalyticsProvider';

export class NotificationProvider {
    private static instance: NotificationProvider;
    private notificationQueue: Array<() => Promise<void>> = [];
    private isProcessing = false;
    private readonly CHECK_INTERVAL = 1000 * 60 * 60; // 1 hour
    private readonly MAX_NOTIFICATIONS = 3; // Maximum number of notifications to show at once
    private activeNotifications = 0;

    private constructor() {
        setInterval(() => this.checkDueDates(), this.CHECK_INTERVAL);
    }

    public static getInstance(): NotificationProvider {
        if (!NotificationProvider.instance) {
            NotificationProvider.instance = new NotificationProvider();
        }
        return NotificationProvider.instance;
    }

    public async showNotification(
        message: string,
        type: NotificationType = 'info',
        ...actions: string[]
    ): Promise<string | undefined> {
        if (this.activeNotifications >= this.MAX_NOTIFICATIONS) {
            // Queue the notification if we're at the limit
            return new Promise((resolve) => {
                this.notificationQueue.push(async () => {
                    const result = await this.displayNotification(message, type, actions);
                    resolve(result);
                });
            });
        }

        return this.displayNotification(message, type, actions);
    }

    private async displayNotification(
        message: string,
        type: NotificationType,
        actions: string[]
    ): Promise<string | undefined> {
        this.activeNotifications++;
        
        try {
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

            // Track the notification
            AnalyticsProvider.getInstance().trackEvent('notification.shown', {
                type,
                message,
                hasActions: actions.length > 0
            });

            return result;
        } finally {
            this.activeNotifications--;
            this.processQueue();
        }
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.notificationQueue.length === 0 || 
            this.activeNotifications >= this.MAX_NOTIFICATIONS) {
            return;
        }

        this.isProcessing = true;
        try {
            const nextNotification = this.notificationQueue.shift();
            if (nextNotification) {
                await nextNotification();
            }
        } finally {
            this.isProcessing = false;
            // Process next notification if available
            if (this.notificationQueue.length > 0) {
                await this.processQueue();
            }
        }
    }

    private async showInfoNotification(
        message: string,
        ...actions: string[]
    ): Promise<string | undefined> {
        return new Promise((resolve) => {
            const notification = vscode.window.showInformationMessage(
                message,
                { modal: false },
                ...actions
            );
            notification.then(resolve);
        });
    }

    private async showWarningNotification(
        message: string,
        ...actions: string[]
    ): Promise<string | undefined> {
        return new Promise((resolve) => {
            const notification = vscode.window.showWarningMessage(
                message,
                { modal: false },
                ...actions
            );
            notification.then(resolve);
        });
    }

    private async showErrorNotification(
        message: string,
        ...actions: string[]
    ): Promise<string | undefined> {
        return new Promise((resolve) => {
            const notification = vscode.window.showErrorMessage(
                message,
                { modal: true },  // Show errors in modal dialog
                ...actions
            );
            notification.then(resolve);
        });
    }

    public async checkDueDates(): Promise<void> {
        const items = await this.getChecklistItems();
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        for (const item of items) {
            if (!item.status && item.dueDate) {
                const dueDate = new Date(item.dueDate);
                
                if (dueDate < now) {
                    await this.showNotification(
                        `Overdue: ${item.title}`,
                        'error',
                        'Open Item',
                        'Mark Complete'
                    );
                } else if (dueDate < tomorrow) {
                    await this.showNotification(
                        `Due Today: ${item.title}`,
                        'warning',
                        'Open Item',
                        'Mark Complete'
                    );
                }
            }
        }
    }

    private async getChecklistItems(): Promise<IChecklistItem[]> {
        // This should be implemented to get items from your data store
        return [];
    }
}
