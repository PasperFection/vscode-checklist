import * as vscode from 'vscode';
import { IChecklistItem, Priority, INote } from './types';
import { format } from 'date-fns';

export class ContextMenuProvider {
    constructor(private readonly context: vscode.ExtensionContext) {
        this.registerCommands();
    }

    private registerCommands() {
        // Set Priority
        this.context.subscriptions.push(
            vscode.commands.registerCommand('implementation-checklist.setPriority', async (item: IChecklistItem) => {
                const priority = await vscode.window.showQuickPick(
                    [
                        { label: '$(circle-filled) High Priority', value: 'high', description: 'Urgent or critical tasks' },
                        { label: '$(circle-filled) Medium Priority', value: 'medium', description: 'Important but not urgent' },
                        { label: '$(circle-filled) Low Priority', value: 'low', description: 'Can be done later' },
                        { label: '$(circle-outline) Clear Priority', value: undefined, description: 'Remove priority' }
                    ],
                    { 
                        placeHolder: 'Select Priority',
                        title: 'Set Item Priority'
                    }
                );

                if (priority) {
                    await vscode.commands.executeCommand('implementation-checklist.updatePriority', item, priority.value);
                    this.showStatusMessage(`Priority ${priority.value ? `set to ${priority.value}` : 'cleared'}`);
                }
            })
        );

        // Set Due Date
        this.context.subscriptions.push(
            vscode.commands.registerCommand('implementation-checklist.setDueDate', async (item: IChecklistItem) => {
                const options = [
                    { label: '$(calendar) Set Due Date', value: 'set' },
                    { label: '$(clear-all) Clear Due Date', value: 'clear' }
                ];

                const action = await vscode.window.showQuickPick(options, {
                    placeHolder: 'Select Action',
                    title: 'Manage Due Date'
                });

                if (!action) return;

                if (action.value === 'set') {
                    const dueDate = await vscode.window.showInputBox({
                        prompt: 'Enter due date (YYYY-MM-DD)',
                        value: item.dueDate ? item.dueDate.split('T')[0] : format(new Date(), 'yyyy-MM-dd'),
                        validateInput: this.validateDate
                    });

                    if (dueDate) {
                        await vscode.commands.executeCommand('implementation-checklist.updateDueDate', item, `${dueDate}T23:59:59Z`);
                        this.showStatusMessage('Due date updated');
                    }
                } else {
                    await vscode.commands.executeCommand('implementation-checklist.updateDueDate', item, undefined);
                    this.showStatusMessage('Due date cleared');
                }
            })
        );

        // Manage Notes
        this.context.subscriptions.push(
            vscode.commands.registerCommand('implementation-checklist.manageNotes', async (item: IChecklistItem) => {
                const options = [
                    { label: '$(add) Add Note', value: 'add' },
                    { label: '$(edit) Edit Note', value: 'edit', description: item.notes?.length ? undefined : '(No notes)' },
                    { label: '$(trash) Delete Note', value: 'delete', description: item.notes?.length ? undefined : '(No notes)' },
                    { label: '$(clear-all) Clear All Notes', value: 'clear', description: item.notes?.length ? undefined : '(No notes)' }
                ];

                const action = await vscode.window.showQuickPick(options, {
                    placeHolder: 'Select Action',
                    title: 'Manage Notes'
                });

                if (!action) return;

                switch (action.value) {
                    case 'add':
                        const newNote = await vscode.window.showInputBox({
                            prompt: 'Enter new note',
                            multiline: true
                        });

                        if (newNote) {
                            const note: INote = {
                                id: Date.now().toString(),
                                text: newNote,
                                createdAt: new Date().toISOString()
                            };
                            const notes = [...(item.notes || []), note];
                            await vscode.commands.executeCommand('implementation-checklist.updateNotes', item, notes);
                            this.showStatusMessage('Note added');
                        }
                        break;

                    case 'edit':
                        if (!item.notes?.length) {
                            vscode.window.showWarningMessage('No notes to edit');
                            return;
                        }

                        const noteToEdit = await vscode.window.showQuickPick(
                            item.notes.map(note => ({
                                label: note.text.substring(0, 50) + (note.text.length > 50 ? '...' : ''),
                                description: format(new Date(note.createdAt), 'yyyy-MM-dd HH:mm'),
                                note
                            })),
                            { placeHolder: 'Select note to edit' }
                        );

                        if (noteToEdit) {
                            const editedText = await vscode.window.showInputBox({
                                prompt: 'Edit note',
                                value: noteToEdit.note.text,
                                multiline: true
                            });

                            if (editedText !== undefined) {
                                const notes = item.notes.map(n => 
                                    n.id === noteToEdit.note.id 
                                        ? { ...n, text: editedText, updatedAt: new Date().toISOString() }
                                        : n
                                );
                                await vscode.commands.executeCommand('implementation-checklist.updateNotes', item, notes);
                                this.showStatusMessage('Note updated');
                            }
                        }
                        break;

                    case 'delete':
                        if (!item.notes?.length) {
                            vscode.window.showWarningMessage('No notes to delete');
                            return;
                        }

                        const noteToDelete = await vscode.window.showQuickPick(
                            item.notes.map(note => ({
                                label: note.text.substring(0, 50) + (note.text.length > 50 ? '...' : ''),
                                description: format(new Date(note.createdAt), 'yyyy-MM-dd HH:mm'),
                                note
                            })),
                            { placeHolder: 'Select note to delete' }
                        );

                        if (noteToDelete) {
                            const notes = item.notes.filter(n => n.id !== noteToDelete.note.id);
                            await vscode.commands.executeCommand('implementation-checklist.updateNotes', item, notes);
                            this.showStatusMessage('Note deleted');
                        }
                        break;

                    case 'clear':
                        const confirm = await vscode.window.showWarningMessage(
                            'Are you sure you want to clear all notes?',
                            { modal: true },
                            'Yes'
                        );
                        if (confirm === 'Yes') {
                            await vscode.commands.executeCommand('implementation-checklist.updateNotes', item, []);
                            this.showStatusMessage('All notes cleared');
                        }
                        break;
                }
            })
        );

        // Manage Tags
        this.context.subscriptions.push(
            vscode.commands.registerCommand('implementation-checklist.manageTags', async (item: IChecklistItem) => {
                const options = [
                    { label: '$(add) Add Tag', value: 'add' },
                    { label: '$(remove) Remove Tag', value: 'remove', description: item.tags?.length ? undefined : '(No tags)' },
                    { label: '$(clear-all) Clear All Tags', value: 'clear', description: item.tags?.length ? undefined : '(No tags)' }
                ];

                const action = await vscode.window.showQuickPick(options, {
                    placeHolder: 'Select Action',
                    title: 'Manage Tags'
                });

                if (!action) return;

                switch (action.value) {
                    case 'add':
                        const existingTags = await vscode.commands.executeCommand('implementation-checklist.getAllTags');
                        let newTag: string | undefined;
                        
                        if (existingTags?.length) {
                            const selection = await vscode.window.showQuickPick(
                                [
                                    { label: '$(add) Create New Tag', value: 'new' },
                                    { label: '$(list-selection) Select Existing Tag', value: 'existing' }
                                ],
                                { placeHolder: 'Create new or select existing tag?' }
                            );

                            if (!selection) return;

                            if (selection.value === 'existing') {
                                const selectedTag = await vscode.window.showQuickPick(
                                    existingTags.map(tag => ({ label: tag })),
                                    { placeHolder: 'Select existing tag' }
                                );
                                if (selectedTag) {
                                    newTag = selectedTag.label;
                                }
                            }
                        }

                        if (!newTag) {
                            newTag = await vscode.window.showInputBox({
                                prompt: 'Enter new tag',
                                validateInput: this.validateTag
                            });
                        }

                        if (newTag) {
                            const tags = [...new Set([...(item.tags || []), newTag])];
                            await vscode.commands.executeCommand('implementation-checklist.updateTags', item, tags);
                            this.showStatusMessage('Tag added');
                        }
                        break;

                    case 'remove':
                        if (!item.tags?.length) {
                            vscode.window.showWarningMessage('No tags to remove');
                            return;
                        }

                        const tagToRemove = await vscode.window.showQuickPick(
                            item.tags.map(tag => ({ label: tag })),
                            { placeHolder: 'Select tag to remove' }
                        );

                        if (tagToRemove) {
                            const tags = item.tags.filter(t => t !== tagToRemove.label);
                            await vscode.commands.executeCommand('implementation-checklist.updateTags', item, tags);
                            this.showStatusMessage('Tag removed');
                        }
                        break;

                    case 'clear':
                        const confirm = await vscode.window.showWarningMessage(
                            'Are you sure you want to clear all tags?',
                            { modal: true },
                            'Yes'
                        );
                        if (confirm === 'Yes') {
                            await vscode.commands.executeCommand('implementation-checklist.updateTags', item, []);
                            this.showStatusMessage('All tags cleared');
                        }
                        break;
                }
            })
        );

        // Move Item
        this.context.subscriptions.push(
            vscode.commands.registerCommand('implementation-checklist.moveItem', async (item: IChecklistItem) => {
                const options = [
                    { label: '$(arrow-up) Move Up', value: 'up', description: 'Move item up in the list' },
                    { label: '$(arrow-down) Move Down', value: 'down', description: 'Move item down in the list' },
                    { label: '$(arrow-left) Move Out', value: 'out', description: 'Move to parent level' },
                    { label: '$(arrow-right) Move In', value: 'in', description: 'Make child of previous item' }
                ];

                const action = await vscode.window.showQuickPick(options, {
                    placeHolder: 'Select Movement',
                    title: 'Move Item'
                });

                if (action) {
                    await vscode.commands.executeCommand('implementation-checklist.updateItemPosition', item, action.value);
                    this.showStatusMessage(`Item moved ${action.value}`);
                }
            })
        );

        // Delete Item
        this.context.subscriptions.push(
            vscode.commands.registerCommand('implementation-checklist.deleteItem', async (item: IChecklistItem) => {
                const confirm = await vscode.window.showWarningMessage(
                    'Are you sure you want to delete this item' + (item.children?.length ? ' and all its children?' : '?'),
                    { modal: true },
                    'Yes'
                );

                if (confirm === 'Yes') {
                    await vscode.commands.executeCommand('implementation-checklist.removeItem', item);
                    this.showStatusMessage('Item deleted');
                }
            })
        );
    }

    private validateTag(tag: string): string | undefined {
        if (!tag) {
            return 'Tag cannot be empty';
        }
        if (tag.length > 50) {
            return 'Tag is too long (max 50 characters)';
        }
        if (!/^[\w\-\s]+$/.test(tag)) {
            return 'Tag can only contain letters, numbers, spaces, and hyphens';
        }
        return undefined;
    }

    private validateDate(date: string): string | undefined {
        if (!date) {
            return 'Date cannot be empty';
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return 'Invalid date format (use YYYY-MM-DD)';
        }
        const parsed = new Date(date);
        if (isNaN(parsed.getTime())) {
            return 'Invalid date';
        }
        return undefined;
    }

    private showStatusMessage(message: string): void {
        vscode.window.setStatusBarMessage(`$(checklist) ${message}`, 3000);
    }

    public getContextMenuItems(item: IChecklistItem): vscode.Command[] {
        return [
            {
                command: 'implementation-checklist.setPriority',
                title: 'Set Priority',
                arguments: [item]
            },
            {
                command: 'implementation-checklist.setDueDate',
                title: 'Set Due Date',
                arguments: [item]
            },
            {
                command: 'implementation-checklist.manageNotes',
                title: 'Manage Notes',
                arguments: [item]
            },
            {
                command: 'implementation-checklist.manageTags',
                title: 'Manage Tags',
                arguments: [item]
            },
            {
                command: 'implementation-checklist.moveItem',
                title: 'Move Item',
                arguments: [item]
            },
            {
                command: 'implementation-checklist.deleteItem',
                title: 'Delete Item',
                arguments: [item]
            }
        ];
    }
}
