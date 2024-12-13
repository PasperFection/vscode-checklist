import * as vscode from 'vscode';

export class WelcomeProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'implementationChecklist.welcome';

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlContent();
    }

    private _getHtmlContent() {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Implementation Checklist</title>
            <style>
                body {
                    padding: 20px;
                    line-height: 1.6;
                }
                .priority-icon {
                    font-size: 1.2em;
                    margin-right: 8px;
                }
                .feature-list {
                    margin-left: 20px;
                }
                .keyboard-shortcut {
                    background: #e0e0e0;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-family: monospace;
                }
            </style>
        </head>
        <body>
            <h1>Welcome to Implementation Checklist</h1>
            
            <h2>Key Features</h2>
            <ul class="feature-list">
                <li><span class="priority-icon">🔴</span> Priority Levels (High, Medium, Low)</li>
                <li>📅 Due Dates</li>
                <li>📝 Notes & Tags</li>
                <li>📋 Project Templates</li>
                <li>🔍 Advanced Filtering & Sorting</li>
            </ul>

            <h2>Getting Started</h2>
            <ol>
                <li>Use the command palette (<span class="keyboard-shortcut">Ctrl+Shift+P</span>) and search for "Implementation Checklist"</li>
                <li>Choose from available templates or create a custom checklist</li>
                <li>Add, modify, and track your implementation items</li>
            </ol>

            <h2>Keyboard Shortcuts</h2>
            <ul>
                <li><span class="keyboard-shortcut">Ctrl+Space</span> Toggle item status</li>
                <li><span class="keyboard-shortcut">Ctrl+Shift+F</span> Filter items</li>
                <li><span class="keyboard-shortcut">Ctrl+Shift+S</span> Sort items</li>
            </ul>
        </body>
        </html>`;
    }
}
