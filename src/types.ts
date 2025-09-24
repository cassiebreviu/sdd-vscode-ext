import * as vscode from 'vscode';

/**
 * Represents the different types of sections in the spec file
 */
export type SectionType = 'section' | 'subsection' | 'subitem';

/**
 * Status of implementation items
 */
export type ImplementationStatus = 'pending' | 'in-progress' | 'completed';

/**
 * Types of spec sections for filtering
 */
export type SpecSectionFilter = 'requirements' | 'implementations' | 'all';

/**
 * Runner configuration for executing uv/uvx commands
 */
export interface Runner {
    cmd: 'uvx' | 'uv';
    argsPrefix: string[];
}

/**
 * Configuration for command execution
 */
export interface CommandConfig {
    cmd: string;
    args: string[];
    cwd?: string;
    shell?: boolean;
}

/**
 * Parsed section information from spec file
 */
export interface ParsedSection {
    label: string;
    line: number;
    type: SectionType;
    parent?: string;
    status?: ImplementationStatus;
    contextValue?: string;
}

/**
 * Extended TreeItem for spec navigation
 */
export interface ISpecTreeItem extends vscode.TreeItem {
    section: string;
    line: number;
    status?: ImplementationStatus;
    contextValue?: string;
}

/**
 * Options for parsing spec files
 */
export interface ParseOptions {
    filter?: SpecSectionFilter;
    includeStatus?: boolean;
    sectionKeywords?: string[];
}

/**
 * File system operations interface
 */
export interface IFileSystemOperations {
    exists(path: string): boolean;
    readFile(path: string): string;
    watchFile(path: string, callback: () => void): vscode.Disposable;
}

/**
 * Spec file manager interface
 */
export interface ISpecFileManager {
    getSpecPath(): string | undefined;
    exists(): boolean;
    getContent(): string | undefined;
    watchForChanges(callback: () => void): vscode.Disposable | undefined;
    getWorkspaceRoot(): string | undefined;
}

/**
 * Parser interface for different spec sections
 */
export interface ISpecParser {
    parseAllSections(filePath: string): ParsedSection[];
    parseRequirements(filePath: string): ParsedSection[];
    parseImplementations(filePath: string): ParsedSection[];
}

/**
 * Command manager interface
 */
export interface ICommandManager {
    registerCommands(context: vscode.ExtensionContext): void;
    executeStartProject(): Promise<void>;
    executeSpecifyCommand(): Promise<void>;
    executePlanCommand(): Promise<void>;
    executeTasksCommand(): Promise<void>;
    executeImplementCommand(): Promise<void>;
}

/**
 * Copilot integration interface
 */
export interface ICopilotIntegration {
    sendMessage(message: string): Promise<void>;
    isAvailable(): Promise<boolean>;
}

/**
 * Tree data provider interface with refresh capability
 */
export interface IRefreshableTreeDataProvider<T> extends vscode.TreeDataProvider<T> {
    refresh(): void;
    onDidChangeTreeData: vscode.Event<T | undefined | void>;
}

/**
 * Extension context interface
 */
export interface IExtensionContext {
    specFileManager: ISpecFileManager;
    specParser: ISpecParser;
    commandManager: ICommandManager;
    copilotIntegration: ICopilotIntegration;
    providers: {
        spec?: IRefreshableTreeDataProvider<ISpecTreeItem>;
        requirements?: IRefreshableTreeDataProvider<ISpecTreeItem>;
        implementations?: IRefreshableTreeDataProvider<ISpecTreeItem>;
        actions?: IRefreshableTreeDataProvider<vscode.TreeItem>;
    };
}