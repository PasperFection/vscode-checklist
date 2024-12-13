import * as vscode from 'vscode';
import { IFilterOptions, ISortOptions, Priority } from '../types';

export class FilterSortPanel {
    public static currentPanel: FilterSortPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._panel.webview.html = this._getWebviewContent();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'applyFilter':
                        vscode.commands.executeCommand('implementation-checklist.applyFilter', message.options);
                        break;
                    case 'applySort':
                        vscode.commands.executeCommand('implementation-checklist.applySort', message.options);
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (FilterSortPanel.currentPanel) {
            FilterSortPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'filterSort',
            'Filter & Sort Checklist',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        FilterSortPanel.currentPanel = new FilterSortPanel(panel, extensionUri);
    }

    private _getWebviewContent() {
        return `<!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    padding: 20px;
                    font-family: var(--vscode-font-family);
                }
                .section {
                    margin-bottom: 24px;
                }
                .form-group {
                    margin-bottom: 16px;
                }
                label {
                    display: block;
                    margin-bottom: 8px;
                }
                select, input {
                    width: 100%;
                    padding: 8px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                }
                button {
                    padding: 8px 16px;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <div class="section">
                <h2>Filter Options</h2>
                <div class="form-group">
                    <label>Priority</label>
                    <select id="priority">
                        <option value="">All</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="status">
                        <option value="">All</option>
                        <option value="true">Completed</option>
                        <option value="false">Pending</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Due Date</label>
                    <select id="dueDate">
                        <option value="">All</option>
                        <option value="overdue">Overdue</option>
                        <option value="today">Due Today</option>
                        <option value="week">Due This Week</option>
                    </select>
                </div>
                <button onclick="applyFilter()">Apply Filter</button>
            </div>

            <div class="section">
                <h2>Sort Options</h2>
                <div class="form-group">
                    <label>Sort By</label>
                    <select id="sortBy">
                        <option value="priority">Priority</option>
                        <option value="dueDate">Due Date</option>
                        <option value="status">Status</option>
                        <option value="label">Label</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Direction</label>
                    <select id="sortDirection">
                        <option value="desc">Descending</option>
                        <option value="asc">Ascending</option>
                    </select>
                </div>
                <button onclick="applySort()">Apply Sort</button>
            </div>

            <script>
                function applyFilter() {
                    const priority = document.getElementById('priority').value;
                    const status = document.getElementById('status').value;
                    const dueDate = document.getElementById('dueDate').value;

                    vscode.postMessage({
                        command: 'applyFilter',
                        options: {
                            priority: priority || undefined,
                            status: status ? status === 'true' : undefined,
                            dueDate: dueDate || undefined
                        }
                    });
                }

                function applySort() {
                    vscode.postMessage({
                        command: 'applySort',
                        options: {
                            by: document.getElementById('sortBy').value,
                            direction: document.getElementById('sortDirection').value
                        }
                    });
                }
            </script>
        </body>
        </html>`;
    }

    public dispose() {
        FilterSortPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
