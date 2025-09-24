import * as vscode from 'vscode';
import { SpecFileManager } from './specFileManager';
import { SpecParser } from './specParser';
import { CommandManager } from './commandManager';
import { CopilotIntegration } from './copilotIntegration';
import { SpecProvider, RequirementsProvider, ImplementationsProvider, ActionsProvider, SpecTreeItem } from './providers';
import { IExtensionContext, IRefreshableTreeDataProvider } from './types';

/**
 * Main extension activator that coordinates all components
 */
export class ExtensionActivator {
    private context: IExtensionContext;
    private retryTimer?: NodeJS.Timeout;
    private fileWatcher?: vscode.Disposable;

    constructor() {
        // Initialize core services
        const specFileManager = new SpecFileManager();
        const specParser = new SpecParser(specFileManager);
        const copilotIntegration = new CopilotIntegration();
        const commandManager = new CommandManager(specFileManager, copilotIntegration);

        this.context = {
            specFileManager,
            specParser,
            commandManager,
            copilotIntegration,
            providers: {}
        };
    }

    /**
     * Activates the extension
     * @param vsCodeContext VS Code extension context
     */
    async activate(vsCodeContext: vscode.ExtensionContext): Promise<void> {
        // Register commands
        this.context.commandManager.registerCommands(vsCodeContext);

        // Initialize Actions provider immediately (doesn't depend on spec files)
        this.context.providers.actions = new ActionsProvider();
        vscode.window.registerTreeDataProvider('actionsView', this.context.providers.actions);

        // Set up spec file dependent providers with retry mechanism
        await this.initializeSpecDependentProviders(vsCodeContext);

        // Set up file watching for spec changes
        this.setupFileWatching(vsCodeContext);

        vscode.window.showInformationMessage('Specify extension activated successfully!');
    }

    /**
     * Deactivates the extension
     */
    deactivate(): void {
        // Clean up retry timer
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = undefined;
        }

        // Clean up file watcher
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = undefined;
        }

        // Dispose command manager if it has a dispose method
        if ('dispose' in this.context.commandManager) {
            (this.context.commandManager as any).dispose();
        }
    }

    /**
     * Initializes providers that depend on spec files
     * @param vsCodeContext VS Code extension context
     */
    private async initializeSpecDependentProviders(vsCodeContext: vscode.ExtensionContext): Promise<void> {
        await this.waitForSpecAndInitializeProviders(vsCodeContext);
    }

    /**
     * Waits for spec file and initializes providers
     * @param vsCodeContext VS Code extension context
     */
    private async waitForSpecAndInitializeProviders(vsCodeContext: vscode.ExtensionContext): Promise<void> {
        // Try to find spec file for up to 10 seconds
        let specPath: string | undefined;
        for (let i = 0; i < 20; i++) {
            specPath = this.context.specFileManager.getSpecPath();
            if (specPath && this.context.specFileManager.exists()) {
                vscode.window.showInformationMessage('spec.md found and parsed!');
                break;
            }
            await this.delay(500);
        }

        if (!specPath || !this.context.specFileManager.exists()) {
            // Start 1-minute retry mechanism
            this.startRetryMechanism(vsCodeContext);
            return;
        }

        // Initialize providers now that spec file is available
        this.createAndRegisterProviders(vsCodeContext);
    }

    /**
     * Creates and registers tree data providers
     * @param vsCodeContext VS Code extension context
     */
    private createAndRegisterProviders(vsCodeContext: vscode.ExtensionContext): void {
        if (!this.context.providers.spec) {
            // Create providers
            this.context.providers.spec = new SpecProvider(
                this.context.specFileManager, 
                this.context.specParser
            );
            this.context.providers.requirements = new RequirementsProvider(
                this.context.specFileManager, 
                this.context.specParser
            );
            this.context.providers.implementations = new ImplementationsProvider(
                this.context.specFileManager, 
                this.context.specParser
            );

            // Register providers
            vscode.window.registerTreeDataProvider('specNavigationView', this.context.providers.spec);
            vscode.window.registerTreeDataProvider('requirementsView', this.context.providers.requirements);
            vscode.window.registerTreeDataProvider('implementationsView', this.context.providers.implementations);
        } else {
            // Refresh existing providers
            this.refreshAllProviders();
        }
    }

    /**
     * Starts the retry mechanism for finding spec files
     * @param vsCodeContext VS Code extension context
     */
    private startRetryMechanism(vsCodeContext: vscode.ExtensionContext): void {
        const scheduleRetry = () => {
            this.retryTimer = setTimeout(async () => {
                const specPath = this.context.specFileManager.getSpecPath();
                if (specPath && this.context.specFileManager.exists()) {
                    vscode.window.showInformationMessage('spec.md found and parsed!');
                    this.createAndRegisterProviders(vsCodeContext);
                } else {
                    scheduleRetry(); // Continue retrying
                }
            }, 1 * 60 * 1000); // 1 minute
        };

        scheduleRetry();
    }

    /**
     * Sets up file watching for spec file changes
     * @param vsCodeContext VS Code extension context
     */
    private setupFileWatching(vsCodeContext: vscode.ExtensionContext): void {
        this.fileWatcher = this.context.specFileManager.watchForChanges(() => {
            this.refreshAllProviders();
            vscode.window.showInformationMessage('spec.md re-parsed!');
        });

        if (this.fileWatcher) {
            vsCodeContext.subscriptions.push(this.fileWatcher);
        }

        // Also listen for document saves
        const saveListener = vscode.workspace.onDidSaveTextDocument((doc) => {
            const specPath = this.context.specFileManager.getSpecPath();
            if (specPath && doc.uri.fsPath === specPath) {
                this.refreshAllProviders();
                vscode.window.showInformationMessage('spec.md reparsed after save!');
            }
        });

        vsCodeContext.subscriptions.push(saveListener);
    }

    /**
     * Refreshes all tree data providers
     */
    private refreshAllProviders(): void {
        if (this.context.providers.spec) {
            this.context.providers.spec.refresh();
        }
        if (this.context.providers.requirements) {
            this.context.providers.requirements.refresh();
        }
        if (this.context.providers.implementations) {
            this.context.providers.implementations.refresh();
        }
        if (this.context.providers.actions) {
            this.context.providers.actions.refresh();
        }
    }

    /**
     * Utility method for creating delays
     * @param ms Milliseconds to delay
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Gets the current extension context (useful for testing)
     * @returns Current extension context
     */
    getContext(): IExtensionContext {
        return this.context;
    }

    /**
     * Manually triggers a reparse of the spec file
     * @param vsCodeContext VS Code extension context (optional, for retry mechanism)
     */
    async reparseSpec(vsCodeContext?: vscode.ExtensionContext): Promise<void> {
        // Clear existing retry timer
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = undefined;
        }

        const specPath = this.context.specFileManager.getSpecPath();
        if (!specPath || !this.context.specFileManager.exists()) {
            vscode.window.showErrorMessage('spec.md not found in workspace. Please add spec.md to your project.');
            // Restart the retry mechanism if context is available
            if (vsCodeContext) {
                await this.waitForSpecAndInitializeProviders(vsCodeContext);
            }
            return;
        }

        // Refresh all providers
        this.refreshAllProviders();
        vscode.window.showInformationMessage('spec.md manually reparsed!');
    }
}