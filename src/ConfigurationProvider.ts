import * as vscode from 'vscode';
import { Priority } from './types';

export interface IChecklistConfiguration {
    defaultPriority: Priority;
    showStatusBar: boolean;
    autoSave: boolean;
    defaultTemplate: string;
    sortOrder: {
        by: 'priority' | 'dueDate' | 'status' | 'label';
        direction: 'asc' | 'desc';
    };
    icons: {
        high: string;
        medium: string;
        low: string;
        completed: string;
        pending: string;
    };
}

export class ConfigurationProvider {
    private static readonly SECTION = 'implementationChecklist';

    public static get configuration(): IChecklistConfiguration {
        const config = vscode.workspace.getConfiguration(this.SECTION);
        
        return {
            defaultPriority: config.get('defaultPriority', 'medium'),
            showStatusBar: config.get('showStatusBar', true),
            autoSave: config.get('autoSave', true),
            defaultTemplate: config.get('defaultTemplate', ''),
            sortOrder: config.get('sortOrder', {
                by: 'priority',
                direction: 'desc'
            }),
            icons: config.get('icons', {
                high: '🔴',
                medium: '🟡',
                low: '🟢',
                completed: '✓',
                pending: '☐'
            })
        };
    }

    public static async updateConfiguration(
        section: keyof IChecklistConfiguration,
        value: any,
        target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
    ) {
        const config = vscode.workspace.getConfiguration(this.SECTION);
        await config.update(section, value, target);
    }

    public static onConfigurationChanged(
        callback: (e: vscode.ConfigurationChangeEvent) => void
    ): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(this.SECTION)) {
                callback(e);
            }
        });
    }
}
