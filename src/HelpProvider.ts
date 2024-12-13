import * as vscode from 'vscode';
import * as path from 'path';

export class HelpProvider implements vscode.TreeDataProvider<HelpItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<HelpItem | undefined | null | void> = new vscode.EventEmitter<HelpItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<HelpItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private readonly extensionUri: vscode.Uri) {}

    getTreeItem(element: HelpItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: HelpItem): Thenable<HelpItem[]> {
        if (!element) {
            return Promise.resolve(this.getRootItems());
        }
        return Promise.resolve(this.getChildItems(element));
    }

    private getRootItems(): HelpItem[] {
        return [
            new HelpItem(
                'Getting Started',
                'Basic usage and concepts',
                vscode.TreeItemCollapsibleState.Collapsed,
                'getting-started'
            ),
            new HelpItem(
                'Features',
                'Available features and functionality',
                vscode.TreeItemCollapsibleState.Collapsed,
                'features'
            ),
            new HelpItem(
                'Keyboard Shortcuts',
                'List of keyboard shortcuts',
                vscode.TreeItemCollapsibleState.Collapsed,
                'shortcuts'
            ),
            new HelpItem(
                'Templates',
                'Using project templates',
                vscode.TreeItemCollapsibleState.Collapsed,
                'templates'
            ),
            new HelpItem(
                'Advanced Usage',
                'Advanced features and tips',
                vscode.TreeItemCollapsibleState.Collapsed,
                'advanced'
            )
        ];
    }

    private getChildItems(item: HelpItem): HelpItem[] {
        switch (item.contextValue) {
            case 'getting-started':
                return this.getGettingStartedItems();
            case 'features':
                return this.getFeatureItems();
            case 'shortcuts':
                return this.getShortcutItems();
            case 'templates':
                return this.getTemplateItems();
            case 'advanced':
                return this.getAdvancedItems();
            default:
                return [];
        }
    }

    private getGettingStartedItems(): HelpItem[] {
        return [
            new HelpItem(
                'Creating Your First Checklist',
                'Learn how to create and manage checklists',
                vscode.TreeItemCollapsibleState.None,
                'help-topic',
                {
                    command: 'implementation-checklist.showHelpTopic',
                    title: 'Show Help Topic',
                    arguments: ['creating-first-checklist']
                }
            ),
            new HelpItem(
                'Understanding Priority Levels',
                'Learn about priority levels and their meanings',
                vscode.TreeItemCollapsibleState.None,
                'help-topic',
                {
                    command: 'implementation-checklist.showHelpTopic',
                    title: 'Show Help Topic',
                    arguments: ['priority-levels']
                }
            ),
            new HelpItem(
                'Managing Due Dates',
                'Learn how to set and track due dates',
                vscode.TreeItemCollapsibleState.None,
                'help-topic',
                {
                    command: 'implementation-checklist.showHelpTopic',
                    title: 'Show Help Topic',
                    arguments: ['managing-due-dates']
                }
            )
        ];
    }

    private getFeatureItems(): HelpItem[] {
        return [
            new HelpItem(
                'Filtering and Sorting',
                'Learn how to filter and sort checklist items',
                vscode.TreeItemCollapsibleState.None,
                'help-topic',
                {
                    command: 'implementation-checklist.showHelpTopic',
                    title: 'Show Help Topic',
                    arguments: ['filtering-sorting']
                }
            ),
            new HelpItem(
                'Statistics and Progress',
                'Understanding statistics and progress tracking',
                vscode.TreeItemCollapsibleState.None,
                'help-topic',
                {
                    command: 'implementation-checklist.showHelpTopic',
                    title: 'Show Help Topic',
                    arguments: ['statistics-progress']
                }
            ),
            new HelpItem(
                'Tags and Notes',
                'Using tags and notes for better organization',
                vscode.TreeItemCollapsibleState.None,
                'help-topic',
                {
                    command: 'implementation-checklist.showHelpTopic',
                    title: 'Show Help Topic',
                    arguments: ['tags-notes']
                }
            )
        ];
    }

    private getShortcutItems(): HelpItem[] {
        return [
            new HelpItem(
                'General Shortcuts',
                'Basic keyboard shortcuts',
                vscode.TreeItemCollapsibleState.None,
                'help-topic',
                {
                    command: 'implementation-checklist.showHelpTopic',
                    title: 'Show Help Topic',
                    arguments: ['general-shortcuts']
                }
            ),
            new HelpItem(
                'Navigation Shortcuts',
                'Shortcuts for navigating the checklist',
                vscode.TreeItemCollapsibleState.None,
                'help-topic',
                {
                    command: 'implementation-checklist.showHelpTopic',
                    title: 'Show Help Topic',
                    arguments: ['navigation-shortcuts']
                }
            ),
            new HelpItem(
                'Edit Shortcuts',
                'Shortcuts for editing items',
                vscode.TreeItemCollapsibleState.None,
                'help-topic',
                {
                    command: 'implementation-checklist.showHelpTopic',
                    title: 'Show Help Topic',
                    arguments: ['edit-shortcuts']
                }
            )
        ];
    }

    private getTemplateItems(): HelpItem[] {
        return [
            new HelpItem(
                'Using Built-in Templates',
                'How to use the built-in project templates',
                vscode.TreeItemCollapsibleState.None,
                'help-topic',
                {
                    command: 'implementation-checklist.showHelpTopic',
                    title: 'Show Help Topic',
                    arguments: ['using-templates']
                }
            ),
            new HelpItem(
                'Creating Custom Templates',
                'Create your own project templates',
                vscode.TreeItemCollapsibleState.None,
                'help-topic',
                {
                    command: 'implementation-checklist.showHelpTopic',
                    title: 'Show Help Topic',
                    arguments: ['custom-templates']
                }
            )
        ];
    }

    private getAdvancedItems(): HelpItem[] {
        return [
            new HelpItem(
                'Advanced Search Syntax',
                'Learn the advanced search syntax',
                vscode.TreeItemCollapsibleState.None,
                'help-topic',
                {
                    command: 'implementation-checklist.showHelpTopic',
                    title: 'Show Help Topic',
                    arguments: ['advanced-search']
                }
            ),
            new HelpItem(
                'Data Import/Export',
                'Import and export checklist data',
                vscode.TreeItemCollapsibleState.None,
                'help-topic',
                {
                    command: 'implementation-checklist.showHelpTopic',
                    title: 'Show Help Topic',
                    arguments: ['data-import-export']
                }
            ),
            new HelpItem(
                'Customizing Themes',
                'Customize the appearance of your checklist',
                vscode.TreeItemCollapsibleState.None,
                'help-topic',
                {
                    command: 'implementation-checklist.showHelpTopic',
                    title: 'Show Help Topic',
                    arguments: ['customizing-themes']
                }
            )
        ];
    }

    public showHelpTopic(topicId: string) {
        const panel = vscode.window.createWebviewPanel(
            'helpTopic',
            this.getTopicTitle(topicId),
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [this.extensionUri]
            }
        );

        panel.webview.html = this.getHelpContent(topicId);
    }

    private getTopicTitle(topicId: string): string {
        const titles: { [key: string]: string } = {
            'creating-first-checklist': 'Creating Your First Checklist',
            'priority-levels': 'Understanding Priority Levels',
            'managing-due-dates': 'Managing Due Dates',
            'filtering-sorting': 'Filtering and Sorting',
            'statistics-progress': 'Statistics and Progress',
            'tags-notes': 'Tags and Notes',
            'general-shortcuts': 'General Shortcuts',
            'navigation-shortcuts': 'Navigation Shortcuts',
            'edit-shortcuts': 'Edit Shortcuts',
            'using-templates': 'Using Built-in Templates',
            'custom-templates': 'Creating Custom Templates',
            'advanced-search': 'Advanced Search Syntax',
            'data-import-export': 'Data Import/Export',
            'customizing-themes': 'Customizing Themes'
        };
        return titles[topicId] || 'Help Topic';
    }

    private getHelpContent(topicId: string): string {
        // Load and return the help content HTML for the specified topic
        return `<!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    padding: 20px;
                    line-height: 1.6;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-editor-foreground);
                }
                h1, h2 {
                    color: var(--vscode-editor-foreground);
                    border-bottom: 1px solid var(--vscode-widget-border);
                    padding-bottom: 5px;
                }
                code {
                    background: var(--vscode-textBlockQuote-background);
                    padding: 2px 4px;
                    border-radius: 3px;
                }
                .note {
                    background: var(--vscode-textBlockQuote-background);
                    padding: 10px;
                    border-left: 4px solid var(--vscode-textLink-activeForeground);
                    margin: 10px 0;
                }
            </style>
        </head>
        <body>
            ${this.getTopicContent(topicId)}
        </body>
        </html>`;
    }

    private getTopicContent(topicId: string): string {
        // Return the specific content for each help topic
        const content: { [key: string]: string } = {
            'creating-first-checklist': `
                <h1>Creating Your First Checklist</h1>
                <p>Get started with Implementation Checklist by following these steps:</p>
                <ol>
                    <li>Open the Command Palette (Ctrl+Shift+P)</li>
                    <li>Type "Implementation Checklist: Create New"</li>
                    <li>Choose a template or start from scratch</li>
                    <li>Add your checklist items</li>
                </ol>
                <div class="note">
                    <strong>Tip:</strong> Use keyboard shortcuts to quickly add and manage items!
                </div>
            `,
            // Add content for other topics...
        };
        return content[topicId] || '<h1>Topic Not Found</h1><p>The requested help topic could not be found.</p>';
    }
}

class HelpItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = description;
        this.iconPath = {
            light: path.join(__filename, '..', '..', 'resources', 'light', this.getIconName()),
            dark: path.join(__filename, '..', '..', 'resources', 'dark', this.getIconName())
        };
    }

    private getIconName(): string {
        switch (this.contextValue) {
            case 'getting-started':
                return 'getting-started.svg';
            case 'features':
                return 'features.svg';
            case 'shortcuts':
                return 'keyboard.svg';
            case 'templates':
                return 'template.svg';
            case 'advanced':
                return 'advanced.svg';
            case 'help-topic':
                return 'help-topic.svg';
            default:
                return 'default.svg';
        }
    }
}
