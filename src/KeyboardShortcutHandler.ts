import * as vscode from 'vscode';
import { IChecklistItem, Priority } from './types';

export class KeyboardShortcutHandler {
    constructor(private readonly context: vscode.ExtensionContext) {
        this.registerShortcuts();
    }

    private registerShortcuts() {
        // Toggle item status (Ctrl+Space)
        this.context.subscriptions.push(
            vscode.commands.registerCommand('implementation-checklist.toggleSelectedItem', () => {
                vscode.commands.executeCommand('implementation-checklist.toggleItem');
            })
        );

        // Quick add item (Ctrl+Enter)
        this.context.subscriptions.push(
            vscode.commands.registerCommand('implementation-checklist.quickAddItem', async () => {
                const label = await vscode.window.showInputBox({
                    prompt: 'Enter checklist item',
                    placeHolder: 'New checklist item'
                });

                if (label) {
                    vscode.commands.executeCommand('implementation-checklist.addItem', { label });
                }
            })
        );

        // Set priority (Alt+1,2,3)
        this.context.subscriptions.push(
            vscode.commands.registerCommand('implementation-checklist.setPriorityHigh', () => {
                this.setPriority('high');
            }),
            vscode.commands.registerCommand('implementation-checklist.setPriorityMedium', () => {
                this.setPriority('medium');
            }),
            vscode.commands.registerCommand('implementation-checklist.setPriorityLow', () => {
                this.setPriority('low');
            })
        );

        // Set due date (Alt+D)
        this.context.subscriptions.push(
            vscode.commands.registerCommand('implementation-checklist.setDueDate', async () => {
                const date = await vscode.window.showInputBox({
                    prompt: 'Enter due date (YYYY-MM-DD)',
                    validateInput: this.validateDate
                });

                if (date) {
                    vscode.commands.executeCommand('implementation-checklist.updateDueDate', new Date(date));
                }
            })
        );

        // Quick filter (Ctrl+Shift+F)
        this.context.subscriptions.push(
            vscode.commands.registerCommand('implementation-checklist.quickFilter', async () => {
                const options = await vscode.window.showQuickPick([
                    { label: 'High Priority', value: 'priority:high' },
                    { label: 'Incomplete Items', value: 'status:false' },
                    { label: 'Overdue Items', value: 'overdue:true' },
                    { label: 'Clear Filters', value: 'clear' }
                ]);

                if (options) {
                    vscode.commands.executeCommand('implementation-checklist.applyFilter', options.value);
                }
            })
        );
    }

    private async setPriority(priority: Priority) {
        vscode.commands.executeCommand('implementation-checklist.updatePriority', priority);
    }

    private validateDate(value: string): string | undefined {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return 'Please use YYYY-MM-DD format';
        }
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            return 'Invalid date';
        }
        return undefined;
    }
}
