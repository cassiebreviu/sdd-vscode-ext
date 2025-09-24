import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ISpecFileManager, IFileSystemOperations } from './types';

/**
 * Default file system operations implementation
 */
class FileSystemOperations implements IFileSystemOperations {
    exists(filePath: string): boolean {
        return fs.existsSync(filePath);
    }

    readFile(filePath: string): string {
        return fs.readFileSync(filePath, 'utf8');
    }

    watchFile(filePath: string, callback: () => void): vscode.Disposable {
        const watcher = vscode.workspace.createFileSystemWatcher(filePath);
        watcher.onDidChange(callback);
        watcher.onDidCreate(callback);
        watcher.onDidDelete(callback);
        return watcher;
    }
}

/**
 * Manages spec file operations and path resolution
 */
export class SpecFileManager implements ISpecFileManager {
    private static readonly SPECS_DIR = 'specs';
    private static readonly SPEC_FILENAME = 'spec.md';
    
    private fileSystemOps: IFileSystemOperations;
    private cachedSpecPath?: string;

    constructor(fileSystemOps?: IFileSystemOperations) {
        this.fileSystemOps = fileSystemOps || new FileSystemOperations();
    }

    /**
     * Gets the path to the spec.md file
     * @returns The absolute path to spec.md or undefined if not found
     */
    getSpecPath(): string | undefined {
        if (this.cachedSpecPath && this.fileSystemOps.exists(this.cachedSpecPath)) {
            return this.cachedSpecPath;
        }

        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            return undefined;
        }

        const specsDir = path.join(folders[0].uri.fsPath, SpecFileManager.SPECS_DIR);
        if (!this.fileSystemOps.exists(specsDir)) {
            return undefined;
        }

        try {
            const subdirs = fs.readdirSync(specsDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory());

            for (const dirent of subdirs) {
                const specPath = path.join(specsDir, dirent.name, SpecFileManager.SPEC_FILENAME);
                if (this.fileSystemOps.exists(specPath)) {
                    this.cachedSpecPath = specPath;
                    return specPath;
                }
            }
        } catch (error) {
            console.error('Error reading specs directory:', error);
        }

        return undefined;
    }

    /**
     * Checks if a spec file exists
     * @returns True if spec.md exists, false otherwise
     */
    exists(): boolean {
        const specPath = this.getSpecPath();
        return specPath !== undefined;
    }

    /**
     * Gets the content of the spec file
     * @returns The content as a string or undefined if file doesn't exist
     */
    getContent(): string | undefined {
        const specPath = this.getSpecPath();
        if (!specPath) {
            return undefined;
        }

        try {
            return this.fileSystemOps.readFile(specPath);
        } catch (error) {
            console.error('Error reading spec file:', error);
            return undefined;
        }
    }

    /**
     * Sets up file watching for spec file changes
     * @param callback Function to call when spec file changes
     * @returns Disposable for cleanup, or undefined if no spec file found
     */
    watchForChanges(callback: () => void): vscode.Disposable | undefined {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            return undefined;
        }

        // Watch for spec.md files in the specs directory and subdirectories
        const pattern = new vscode.RelativePattern(folders[0], `**/${SpecFileManager.SPEC_FILENAME}`);
        
        try {
            return this.fileSystemOps.watchFile(pattern.pattern, () => {
                // Clear cached path when file changes
                this.cachedSpecPath = undefined;
                callback();
            });
        } catch (error) {
            console.error('Error setting up file watcher:', error);
            return undefined;
        }
    }

    /**
     * Clears the cached spec path (useful for testing or force refresh)
     */
    clearCache(): void {
        this.cachedSpecPath = undefined;
    }

    /**
     * Gets the workspace root path
     * @returns The workspace root path or undefined if no workspace
     */
    getWorkspaceRoot(): string | undefined {
        const folders = vscode.workspace.workspaceFolders;
        return folders && folders.length > 0 ? folders[0].uri.fsPath : undefined;
    }
}