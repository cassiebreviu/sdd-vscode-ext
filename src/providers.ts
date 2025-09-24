import * as vscode from 'vscode';
import { ISpecTreeItem, ParsedSection, IRefreshableTreeDataProvider, ISpecParser, ISpecFileManager, ImplementationStatus } from './types';

/**
 * Enhanced TreeItem implementation for spec navigation
 */
export class SpecTreeItem extends vscode.TreeItem implements ISpecTreeItem {
    public section: string;
    public line: number;
    public status?: ImplementationStatus;

    constructor(
        label: string,
        section: string,
        line: number,
        collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
        status?: ImplementationStatus
    ) {
        super(label, collapsibleState);
        this.section = section;
        this.line = line;
        this.status = status;
        
        // Set up command for opening spec section
        this.command = {
            command: 'sdd-vscode-ext.openSpecSection',
            title: 'Open Spec Section',
            arguments: [section, line]
        };
    }
}

/**
 * Base class for all tree data providers to reduce duplication
 */
abstract class BaseTreeDataProvider<T extends vscode.TreeItem> implements IRefreshableTreeDataProvider<T> {
    private _onDidChangeTreeData: vscode.EventEmitter<T | undefined | void> = new vscode.EventEmitter<T | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<T | undefined | void> = this._onDidChangeTreeData.event;
    
    protected items: T[] = [];
    protected specFileManager: ISpecFileManager;
    protected specParser: ISpecParser;

    constructor(specFileManager: ISpecFileManager, specParser: ISpecParser) {
        this.specFileManager = specFileManager;
        this.specParser = specParser;
        this.refresh();
    }

    refresh(): void {
        const specPath = this.specFileManager.getSpecPath();
        if (specPath) {
            this.items = this.parseItems(specPath);
        } else {
            this.items = [];
        }
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: T): vscode.TreeItem {
        return this.decorateTreeItem(element);
    }

    getChildren(element?: T): Thenable<T[]> {
        if (!element) {
            // Return top-level sections
            return Promise.resolve(this.items.filter(item => item.contextValue === 'section'));
        } else if (element.contextValue === 'section') {
            // Return subsections for this section
            const specItem = element as unknown as ISpecTreeItem;
            return Promise.resolve(
                this.items.filter(item => 
                    item.contextValue === 'subsection' && 
                    (item as unknown as ISpecTreeItem).section === specItem.label
                )
            );
        } else if (element.contextValue === 'subsection') {
            // Return subitems for this subsection
            const specItem = element as unknown as ISpecTreeItem;
            return Promise.resolve(
                this.items.filter(item => 
                    item.contextValue === 'subitem' && 
                    (item as unknown as ISpecTreeItem).section === specItem.label
                )
            );
        }
        
        return Promise.resolve([]);
    }

    /**
     * Abstract method to parse items from spec file
     * @param filePath Path to the spec file
     */
    protected abstract parseItems(filePath: string): T[];

    /**
     * Hook for decorating tree items (e.g., adding status indicators)
     * @param element Tree item to decorate
     */
    protected decorateTreeItem(element: T): vscode.TreeItem {
        return element;
    }

    /**
     * Converts parsed sections to tree items
     * @param sections Parsed sections from spec file
     */
    protected convertSectionsToTreeItems(sections: ParsedSection[]): SpecTreeItem[] {
        return sections.map(section => {
            const collapsibleState = section.type === 'subitem' 
                ? vscode.TreeItemCollapsibleState.None 
                : vscode.TreeItemCollapsibleState.Collapsed;

            const item = new SpecTreeItem(
                section.label,
                section.parent || section.label,
                section.line,
                collapsibleState,
                section.status
            );

            item.contextValue = section.contextValue;
            item.iconPath = this.getIconForSectionType(section.type);
            
            return item;
        });
    }

    /**
     * Gets appropriate icon for section type
     * @param type Section type
     */
    private getIconForSectionType(type: string): vscode.ThemeIcon {
        switch (type) {
            case 'section':
                return new vscode.ThemeIcon('symbol-key');
            case 'subsection':
                return new vscode.ThemeIcon('symbol-field');
            case 'subitem':
                return new vscode.ThemeIcon('list-unordered');
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }
}

/**
 * Provider for general spec navigation
 */
export class SpecProvider extends BaseTreeDataProvider<SpecTreeItem> {
    protected parseItems(filePath: string): SpecTreeItem[] {
        const sections = this.specParser.parseAllSections(filePath);
        return this.convertSectionsToTreeItems(sections);
    }
}

/**
 * Provider for requirements sections
 */
export class RequirementsProvider extends BaseTreeDataProvider<SpecTreeItem> {
    protected parseItems(filePath: string): SpecTreeItem[] {
        const sections = this.specParser.parseRequirements(filePath);
        return this.convertSectionsToTreeItems(sections);
    }
}

/**
 * Provider for implementation sections with status indicators
 */
export class ImplementationsProvider extends BaseTreeDataProvider<SpecTreeItem> {
    protected parseItems(filePath: string): SpecTreeItem[] {
        const sections = this.specParser.parseImplementations(filePath);
        return this.convertSectionsToTreeItems(sections);
    }

    protected decorateTreeItem(element: SpecTreeItem): vscode.TreeItem {
        // Add status indicators for implementation items
        if (element.status && element.contextValue === 'subitem') {
            const statusIcon = this.getStatusIcon(element.status);
            const decoratedItem = new SpecTreeItem(
                `${statusIcon} ${element.label}`,
                element.section,
                element.line,
                element.collapsibleState,
                element.status
            );
            
            decoratedItem.contextValue = element.contextValue;
            decoratedItem.iconPath = this.getStatusIconPath(element.status);
            return decoratedItem;
        }
        
        return element;
    }

    private getStatusIcon(status: ImplementationStatus): string {
        switch (status) {
            case 'completed':
                return '✓';
            case 'in-progress':
                return '⏳';
            default:
                return '◯';
        }
    }

    private getStatusIconPath(status: ImplementationStatus): vscode.ThemeIcon {
        return status === 'completed' 
            ? new vscode.ThemeIcon('check') 
            : new vscode.ThemeIcon('circle-outline');
    }
}

/**
 * Provider for action items in the extension
 */
export class ActionsProvider implements IRefreshableTreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = 
        new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!element) {
            return Promise.resolve([
                this.createActionItem(
                    '1. Start Specify',
                    'Create a new specification file',
                    'sdd-vscode-ext.startProject',
                    'plus'
                ),
                this.createActionItem(
                    '2. Prompt - Specify Feature/App',
                    'Send custom specification to Copilot',
                    'sdd-vscode-ext.specifyCommand',
                    'lightbulb'
                ),
                this.createActionItem(
                    '3. Plan - Define Tech Stack',
                    'Command to provide your tech stack and architecture choices',
                    'sdd-vscode-ext.planCommand',
                    'wand'
                ),
                this.createActionItem(
                    '4. Tasks - Actionable Task List',
                    'Create actionable task list from implementation plan',
                    'sdd-vscode-ext.tasksCommand',
                    'checklist'
                ),
                this.createActionItem(
                    '5. Implement - Create the Feature/App',
                    'Execute /implement slash command in Copilot',
                    'sdd-vscode-ext.implementSpecRocket',
                    'rocket'
                )
            ]);
        }
        
        return Promise.resolve([]);
    }

    private createActionItem(label: string, tooltip: string, command: string, icon: string): vscode.TreeItem {
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
        item.tooltip = tooltip;
        item.command = {
            command: command,
            title: label
        };
        item.iconPath = new vscode.ThemeIcon(icon);
        item.contextValue = 'action';
        return item;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}