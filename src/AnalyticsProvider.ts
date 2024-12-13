import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { format, startOfDay, endOfDay, eachDayOfInterval, subDays } from 'date-fns';
import { IAnalyticsEvent, IAnalyticsSummary } from './types';

export class AnalyticsProvider {
    private static instance: AnalyticsProvider;
    private readonly analyticsDir: string;
    private readonly currentLogFile: string;
    private readonly anonymousId: string;
    private isEnabled: boolean;
    private eventBuffer: IAnalyticsEvent[] = [];
    private flushTimeout: NodeJS.Timeout | null = null;
    private readonly FLUSH_INTERVAL = 5000; // 5 seconds
    private readonly MAX_BUFFER_SIZE = 100;

    private constructor() {
        this.analyticsDir = path.join(
            this.getStorageDirectory(),
            '.implementation-checklist-analytics'
        );
        this.currentLogFile = this.getCurrentLogFilePath();
        this.anonymousId = this.generateAnonymousId();
        this.isEnabled = this.getAnalyticsEnabled();

        this.ensureAnalyticsDirectory();
        this.startPeriodicCleanup();
    }

    public static getInstance(): AnalyticsProvider {
        if (!AnalyticsProvider.instance) {
            AnalyticsProvider.instance = new AnalyticsProvider();
        }
        return AnalyticsProvider.instance;
    }

    private getStorageDirectory(): string {
        return vscode.workspace.workspaceFolders?.[0].uri.fsPath || 
               path.join(process.env.HOME || process.env.USERPROFILE || '', '.vscode-implementation-checklist');
    }

    private getCurrentLogFilePath(): string {
        const now = new Date();
        return path.join(
            this.analyticsDir,
            `analytics-${format(now, 'yyyy-MM')}.json`
        );
    }

    private async ensureAnalyticsDirectory() {
        try {
            await fs.promises.mkdir(this.analyticsDir, { recursive: true });
        } catch (error) {
            console.error('Failed to create analytics directory:', error);
            vscode.window.showErrorMessage('Failed to initialize analytics storage');
        }
    }

    private generateAnonymousId(): string {
        const machineId = vscode.env.machineId;
        const workspaceId = vscode.workspace.workspaceFolders?.[0].uri.fsPath || '';
        return crypto
            .createHash('md5')
            .update(machineId + workspaceId)
            .digest('hex')
            .substring(0, 8);
    }

    private getAnalyticsEnabled(): boolean {
        return vscode.workspace
            .getConfiguration('implementation-checklist')
            .get('enableAnalytics', true);
    }

    public async setEnabled(enabled: boolean) {
        this.isEnabled = enabled;
        await vscode.workspace
            .getConfiguration('implementation-checklist')
            .update('enableAnalytics', enabled, vscode.ConfigurationTarget.Global);
        
        if (!enabled) {
            await this.flushEvents(); // Flush any remaining events before disabling
        }
        
        vscode.window.showInformationMessage(
            `Analytics ${enabled ? 'enabled' : 'disabled'} for Implementation Checklist`
        );
    }

    public async trackEvent(
        eventName: string,
        properties?: { [key: string]: any }
    ): Promise<void> {
        if (!this.isEnabled) {
            return;
        }

        const event: IAnalyticsEvent = {
            eventName,
            timestamp: new Date().toISOString(),
            properties: {
                ...properties,
                anonymousId: this.anonymousId,
                vscodeVersion: vscode.version,
                extensionVersion: vscode.extensions.getExtension(
                    'pasperfection.vscode-checklist'
                )?.packageJSON.version
            }
        };

        this.eventBuffer.push(event);

        if (this.eventBuffer.length >= this.MAX_BUFFER_SIZE) {
            await this.flushEvents();
        } else if (!this.flushTimeout) {
            this.flushTimeout = setTimeout(() => this.flushEvents(), this.FLUSH_INTERVAL);
        }
    }

    private async flushEvents(): Promise<void> {
        if (this.flushTimeout) {
            clearTimeout(this.flushTimeout);
            this.flushTimeout = null;
        }

        if (this.eventBuffer.length === 0) {
            return;
        }

        try {
            let events: IAnalyticsEvent[] = [];
            if (fs.existsSync(this.currentLogFile)) {
                const data = await fs.promises.readFile(this.currentLogFile, 'utf8');
                events = JSON.parse(data);
            }

            events.push(...this.eventBuffer);
            await fs.promises.writeFile(
                this.currentLogFile,
                JSON.stringify(events, null, 2)
            );
            this.eventBuffer = [];
        } catch (error) {
            console.error('Failed to flush analytics events:', error);
            // Keep events in buffer to try again later
        }
    }

    public async getSummary(days: number = 30): Promise<IAnalyticsSummary> {
        const summary: IAnalyticsSummary = {
            totalEvents: 0,
            eventTypes: {},
            dailyActivity: {},
            topFeatures: []
        };

        try {
            const endDate = endOfDay(new Date());
            const startDate = startOfDay(subDays(endDate, days));
            const logFiles = await this.getLogFilesInRange(startDate, endDate);

            for (const file of logFiles) {
                if (fs.existsSync(file)) {
                    const data = await fs.promises.readFile(file, 'utf8');
                    const events: IAnalyticsEvent[] = JSON.parse(data);

                    events.forEach(event => {
                        const eventDate = new Date(event.timestamp);
                        if (eventDate >= startDate && eventDate <= endDate) {
                            summary.totalEvents++;
                            summary.eventTypes[event.eventName] = (summary.eventTypes[event.eventName] || 0) + 1;
                            
                            const dateKey = format(eventDate, 'yyyy-MM-dd');
                            summary.dailyActivity[dateKey] = (summary.dailyActivity[dateKey] || 0) + 1;
                        }
                    });
                }
            }

            // Calculate top features
            summary.topFeatures = Object.entries(summary.eventTypes)
                .map(([feature, count]) => ({ feature, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            // Fill in missing days with zero activity
            const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
            dateRange.forEach(date => {
                const dateKey = format(date, 'yyyy-MM-dd');
                if (!summary.dailyActivity[dateKey]) {
                    summary.dailyActivity[dateKey] = 0;
                }
            });

        } catch (error) {
            console.error('Failed to generate analytics summary:', error);
            vscode.window.showErrorMessage('Failed to generate analytics summary');
        }

        return summary;
    }

    private async getLogFilesInRange(startDate: Date, endDate: Date): Promise<string[]> {
        const startMonth = format(startDate, 'yyyy-MM');
        const endMonth = format(endDate, 'yyyy-MM');
        const files = await fs.promises.readdir(this.analyticsDir);
        
        return files
            .filter(file => file.startsWith('analytics-') && file.endsWith('.json'))
            .filter(file => {
                const month = file.slice(10, 17); // Extract YYYY-MM from filename
                return month >= startMonth && month <= endMonth;
            })
            .map(file => path.join(this.analyticsDir, file));
    }

    private async startPeriodicCleanup() {
        try {
            // Keep only last 12 months of analytics
            const files = await fs.promises.readdir(this.analyticsDir);
            const now = new Date();
            const cutoffDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
            
            for (const file of files) {
                if (file.startsWith('analytics-') && file.endsWith('.json')) {
                    const month = file.slice(10, 17); // Extract YYYY-MM from filename
                    const fileDate = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5, 7)) - 1, 1);
                    
                    if (fileDate < cutoffDate) {
                        await fs.promises.unlink(path.join(this.analyticsDir, file));
                    }
                }
            }
        } catch (error) {
            console.error('Failed to cleanup old analytics files:', error);
        }
    }

    public async exportAnalytics(format: 'json' | 'csv'): Promise<string> {
        try {
            const summary = await this.getSummary(30);
            const exportPath = path.join(
                this.getStorageDirectory(),
                `analytics-export-${format(new Date(), 'yyyy-MM-dd')}.${format}`
            );

            if (format === 'json') {
                await fs.promises.writeFile(exportPath, JSON.stringify(summary, null, 2));
            } else {
                const csvContent = this.convertToCSV(summary);
                await fs.promises.writeFile(exportPath, csvContent);
            }

            return exportPath;
        } catch (error) {
            console.error('Failed to export analytics:', error);
            throw new Error('Failed to export analytics');
        }
    }

    private convertToCSV(summary: IAnalyticsSummary): string {
        const lines: string[] = [];
        
        // Summary section
        lines.push('Summary');
        lines.push(`Total Events,${summary.totalEvents}`);
        lines.push('');

        // Event Types section
        lines.push('Event Types');
        lines.push('Event,Count');
        Object.entries(summary.eventTypes).forEach(([event, count]) => {
            lines.push(`${event},${count}`);
        });
        lines.push('');

        // Daily Activity section
        lines.push('Daily Activity');
        lines.push('Date,Events');
        Object.entries(summary.dailyActivity).forEach(([date, count]) => {
            lines.push(`${date},${count}`);
        });
        lines.push('');

        // Top Features section
        lines.push('Top Features');
        lines.push('Feature,Count');
        summary.topFeatures.forEach(({ feature, count }) => {
            lines.push(`${feature},${count}`);
        });

        return lines.join('\n');
    }
}
