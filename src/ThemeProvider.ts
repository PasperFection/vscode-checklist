import * as vscode from 'vscode';
import { NotificationProvider } from './NotificationProvider';
import { ITheme, ThemeName } from './types';

export class ThemeProvider {
    private static instance: ThemeProvider;
    private currentTheme: ITheme;
    private customThemes: Map<string, ITheme> = new Map();
    private context?: vscode.ExtensionContext;
    private readonly defaultTheme: ITheme = {
        name: 'default',
        colors: {
            priorityHigh: '#e51400',
            priorityMedium: '#ff8c00',
            priorityLow: '#339933',
            completed: '#4CAF50',
            pending: '#757575',
            overdue: '#e51400',
            dueSoon: '#ff8c00',
            background: '#ffffff',
            foreground: '#333333',
            border: '#cccccc',
            hover: '#f0f0f0',
            selected: '#e0e0e0'
        },
        icons: {
            completed: 'check',
            pending: 'circle-outline',
            expanded: 'chevron-down',
            collapsed: 'chevron-right',
            priority: 'alert',
            date: 'calendar',
            tag: 'tag',
            note: 'note'
        }
    };

    private constructor() {
        this.currentTheme = this.defaultTheme;
        this.registerThemes();
    }

    public static getInstance(): ThemeProvider {
        if (!ThemeProvider.instance) {
            ThemeProvider.instance = new ThemeProvider();
        }
        return ThemeProvider.instance;
    }

    public initialize(context: vscode.ExtensionContext): void {
        this.context = context;
        this.loadSavedTheme();
        this.listenToThemeChanges();
    }

    public getCurrentTheme(): ITheme {
        return this.currentTheme;
    }

    public async setTheme(themeName: ThemeName): Promise<void> {
        const theme = this.customThemes.get(themeName) || this.defaultTheme;
        this.currentTheme = theme;
        
        if (this.context) {
            await this.context.globalState.update('selectedTheme', themeName);
            this.applyTheme();
            NotificationProvider.getInstance().showNotification(
                `Theme changed to ${themeName}`,
                'info'
            );
        }
    }

    public getAvailableThemes(): ThemeName[] {
        return Array.from(this.customThemes.keys()) as ThemeName[];
    }

    private registerThemes(): void {
        // Modern Dark Theme
        this.customThemes.set('modern-dark', {
            name: 'modern-dark',
            colors: {
                ...this.defaultTheme.colors,
                background: '#1e1e1e',
                foreground: '#d4d4d4',
                border: '#404040',
                hover: '#2d2d2d',
                selected: '#37373d'
            },
            icons: this.defaultTheme.icons
        });

        // Modern Light Theme
        this.customThemes.set('modern-light', {
            name: 'modern-light',
            colors: {
                ...this.defaultTheme.colors,
                background: '#ffffff',
                foreground: '#333333',
                border: '#e0e0e0',
                hover: '#f5f5f5',
                selected: '#e8e8e8'
            },
            icons: this.defaultTheme.icons
        });

        // Ocean Dark Theme
        this.customThemes.set('ocean-dark', {
            name: 'ocean-dark',
            colors: {
                ...this.defaultTheme.colors,
                background: '#0d2231',
                foreground: '#8ec7ed',
                border: '#1b4b72',
                hover: '#163c5c',
                selected: '#1e4d6d'
            },
            icons: this.defaultTheme.icons
        });
    }

    private async loadSavedTheme(): Promise<void> {
        if (this.context) {
            const savedTheme = this.context.globalState.get<ThemeName>('selectedTheme');
            if (savedTheme) {
                await this.setTheme(savedTheme);
            }
        }
    }

    private listenToThemeChanges(): void {
        vscode.window.onDidChangeActiveColorTheme(() => {
            this.applyTheme();
        });
    }

    private applyTheme(): void {
        // Apply theme colors to VS Code UI elements
        const workbench = vscode.workspace.getConfiguration('workbench');
        const editor = vscode.workspace.getConfiguration('editor');
        
        workbench.update('colorCustomizations', {
            'list.activeSelectionBackground': this.currentTheme.colors.selected,
            'list.hoverBackground': this.currentTheme.colors.hover,
            'list.inactiveSelectionBackground': this.currentTheme.colors.hover
        }, true);

        editor.update('tokenColorCustomizations', {
            'textMateRules': [
                {
                    'scope': 'checklist.high-priority',
                    'settings': {
                        'foreground': this.currentTheme.colors.priorityHigh
                    }
                },
                {
                    'scope': 'checklist.medium-priority',
                    'settings': {
                        'foreground': this.currentTheme.colors.priorityMedium
                    }
                },
                {
                    'scope': 'checklist.low-priority',
                    'settings': {
                        'foreground': this.currentTheme.colors.priorityLow
                    }
                }
            ]
        }, true);
    }
}
