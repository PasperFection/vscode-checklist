import * as vscode from 'vscode';

interface ITheme {
    name: string;
    colors: {
        priorityHigh: string;
        priorityMedium: string;
        priorityLow: string;
        completed: string;
        pending: string;
        overdue: string;
        dueSoon: string;
        background: string;
        foreground: string;
        border: string;
        hover: string;
        selected: string;
    };
    icons: {
        completed: string;
        pending: string;
        expanded: string;
        collapsed: string;
        priority: string;
        date: string;
        tag: string;
        note: string;
    };
}

export class ThemeProvider {
    private static instance: ThemeProvider;
    private currentTheme: ITheme;
    private customThemes: Map<string, ITheme> = new Map();
    private styleElement?: vscode.WebviewElement;

    private constructor() {
        this.currentTheme = this.getDefaultTheme();
        this.registerThemes();
        this.listenToThemeChanges();
    }

    public static getInstance(): ThemeProvider {
        if (!ThemeProvider.instance) {
            ThemeProvider.instance = new ThemeProvider();
        }
        return ThemeProvider.instance;
    }

    private getDefaultTheme(): ITheme {
        const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
        
        return {
            name: 'Default',
            colors: {
                priorityHigh: isDark ? '#ff6b6b' : '#d63031',
                priorityMedium: isDark ? '#ffd93d' : '#fdcb6e',
                priorityLow: isDark ? '#6bff6b' : '#00b894',
                completed: isDark ? '#6bff6b' : '#00b894',
                pending: isDark ? '#ffd93d' : '#fdcb6e',
                overdue: isDark ? '#ff6b6b' : '#d63031',
                dueSoon: isDark ? '#ffd93d' : '#fdcb6e',
                background: isDark ? '#2d2d2d' : '#ffffff',
                foreground: isDark ? '#ffffff' : '#2d2d2d',
                border: isDark ? '#404040' : '#e0e0e0',
                hover: isDark ? '#404040' : '#f5f5f5',
                selected: isDark ? '#505050' : '#e8e8e8'
            },
            icons: {
                completed: '✓',
                pending: '☐',
                expanded: '▾',
                collapsed: '▸',
                priority: '⚡',
                date: '📅',
                tag: '🏷️',
                note: '📝'
            }
        };
    }

    private registerThemes() {
        // Modern Dark
        this.customThemes.set('modern-dark', {
            name: 'Modern Dark',
            colors: {
                priorityHigh: '#ff7675',
                priorityMedium: '#ffeaa7',
                priorityLow: '#55efc4',
                completed: '#55efc4',
                pending: '#ffeaa7',
                overdue: '#ff7675',
                dueSoon: '#ffeaa7',
                background: '#2d3436',
                foreground: '#dfe6e9',
                border: '#636e72',
                hover: '#4d5656',
                selected: '#576574'
            },
            icons: this.currentTheme.icons
        });

        // Light Modern
        this.customThemes.set('modern-light', {
            name: 'Modern Light',
            colors: {
                priorityHigh: '#e17055',
                priorityMedium: '#fdcb6e',
                priorityLow: '#00b894',
                completed: '#00b894',
                pending: '#fdcb6e',
                overdue: '#e17055',
                dueSoon: '#fdcb6e',
                background: '#ffffff',
                foreground: '#2d3436',
                border: '#b2bec3',
                hover: '#f5f6fa',
                selected: '#dfe6e9'
            },
            icons: this.currentTheme.icons
        });

        // Ocean Dark
        this.customThemes.set('ocean-dark', {
            name: 'Ocean Dark',
            colors: {
                priorityHigh: '#ff7f50',
                priorityMedium: '#ffd700',
                priorityLow: '#98fb98',
                completed: '#98fb98',
                pending: '#ffd700',
                overdue: '#ff7f50',
                dueSoon: '#ffd700',
                background: '#1e3d59',
                foreground: '#f5f0e1',
                border: '#3d5a80',
                hover: '#2b5278',
                selected: '#446b9e'
            },
            icons: this.currentTheme.icons
        });
    }

    private listenToThemeChanges() {
        vscode.window.onDidChangeActiveColorTheme(() => {
            this.currentTheme = this.getDefaultTheme();
            this.updateStyles();
        });
    }

    public setTheme(themeName: string) {
        const theme = this.customThemes.get(themeName) || this.getDefaultTheme();
        this.currentTheme = theme;
        this.updateStyles();
    }

    public getCurrentTheme(): ITheme {
        return this.currentTheme;
    }

    public getAvailableThemes(): string[] {
        return ['default', ...Array.from(this.customThemes.keys())];
    }

    public getThemeCSS(): string {
        const theme = this.currentTheme;
        return `
            :root {
                --priority-high: ${theme.colors.priorityHigh};
                --priority-medium: ${theme.colors.priorityMedium};
                --priority-low: ${theme.colors.priorityLow};
                --completed: ${theme.colors.completed};
                --pending: ${theme.colors.pending};
                --overdue: ${theme.colors.overdue};
                --due-soon: ${theme.colors.dueSoon};
                --background: ${theme.colors.background};
                --foreground: ${theme.colors.foreground};
                --border: ${theme.colors.border};
                --hover: ${theme.colors.hover};
                --selected: ${theme.colors.selected};
            }

            .checklist-item {
                color: var(--foreground);
                background: var(--background);
                border: 1px solid var(--border);
            }

            .checklist-item:hover {
                background: var(--hover);
            }

            .checklist-item.selected {
                background: var(--selected);
            }

            .priority-high { color: var(--priority-high); }
            .priority-medium { color: var(--priority-medium); }
            .priority-low { color: var(--priority-low); }
            .completed { color: var(--completed); }
            .pending { color: var(--pending); }
            .overdue { color: var(--overdue); }
            .due-soon { color: var(--due-soon); }
        `;
    }

    private updateStyles() {
        if (this.styleElement) {
            this.styleElement.innerHTML = this.getThemeCSS();
        }
    }

    public attachToWebview(webview: vscode.Webview) {
        this.styleElement = webview.createElement('style');
        this.styleElement.innerHTML = this.getThemeCSS();
        webview.appendChild(this.styleElement);
    }
}
