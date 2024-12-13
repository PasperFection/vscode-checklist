import * as vscode from 'vscode';
import { templates } from '../templates';
import { IChecklistTemplate } from '../types';

export class TemplateSelectorPanel {
    public static currentPanel: TemplateSelectorPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._panel.webview.html = this._getWebviewContent();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'selectTemplate':
                        const template = templates[message.templateId];
                        if (template) {
                            vscode.commands.executeCommand('implementation-checklist.createFromTemplate', template);
                        }
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

        if (TemplateSelectorPanel.currentPanel) {
            TemplateSelectorPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'templateSelector',
            'Select Template',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        TemplateSelectorPanel.currentPanel = new TemplateSelectorPanel(panel, extensionUri);
    }

    private _getWebviewContent() {
        const templateCards = Object.entries(templates)
            .map(([id, template]) => `
                <div class="template-card" onclick="selectTemplate('${id}')">
                    <h3>${template.name}</h3>
                    <p>${template.description}</p>
                    <div class="template-items">
                        ${this._renderTemplateItems(template)}
                    </div>
                </div>
            `)
            .join('');

        return `<!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    padding: 20px;
                    font-family: var(--vscode-font-family);
                }
                .template-card {
                    border: 1px solid var(--vscode-widget-border);
                    border-radius: 6px;
                    padding: 16px;
                    margin-bottom: 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .template-card:hover {
                    background: var(--vscode-list-hoverBackground);
                }
                .template-items {
                    margin-top: 12px;
                    font-size: 0.9em;
                    color: var(--vscode-descriptionForeground);
                }
            </style>
        </head>
        <body>
            <h2>Select a Template</h2>
            <div class="template-container">
                ${templateCards}
            </div>
            <script>
                function selectTemplate(templateId) {
                    vscode.postMessage({
                        command: 'selectTemplate',
                        templateId: templateId
                    });
                }
            </script>
        </body>
        </html>`;
    }

    private _renderTemplateItems(template: IChecklistTemplate): string {
        return template.items
            .map(item => `• ${item.label}`)
            .join('<br>');
    }

    public dispose() {
        TemplateSelectorPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
