import * as vscode from 'vscode';
import { ICopilotIntegration } from './types';

/**
 * Handles integration with GitHub Copilot Chat
 */
export class CopilotIntegration implements ICopilotIntegration {
    private static readonly COPILOT_COMMANDS = [
        'workbench.action.chat.open',
        'github.copilot.chat.newChatFromSelection',
        'github.copilot.chat.newChat',
        'workbench.panel.chat.view.copilot.focus'
    ];

    /**
     * Sends a message to Copilot Chat
     * @param message Message to send
     */
    async sendMessage(message: string): Promise<void> {
        const success = await this.tryExecuteCommands(message);
        
        if (!success) {
            await this.showCopilotNotAvailableError();
        }
    }

    /**
     * Checks if Copilot is available
     * @returns True if Copilot is available, false otherwise
     */
    async isAvailable(): Promise<boolean> {
        try {
            // Try to execute a simple Copilot command to check availability
            await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Tries to execute Copilot commands in order of preference
     * @param message Message to send
     * @returns True if successful, false otherwise
     */
    private async tryExecuteCommands(message: string): Promise<boolean> {
        // Try the newest chat API first
        if (await this.tryExecuteCommand('workbench.action.chat.open', { query: message })) {
            return true;
        }

        // Fallback to Copilot-specific commands
        if (await this.tryExecuteCommand('github.copilot.chat.newChatFromSelection', { message })) {
            return true;
        }

        // Alternative Copilot command
        if (await this.tryExecuteCommand('github.copilot.chat.newChat', message)) {
            return true;
        }

        // Last resort: just open the chat panel
        if (await this.tryExecuteCommand('workbench.panel.chat.view.copilot.focus')) {
            vscode.window.showInformationMessage(`Copilot chat opened. Please ask: "${message}"`);
            return true;
        }

        return false;
    }

    /**
     * Tries to execute a single command with error handling
     * @param commandId Command ID to execute
     * @param args Command arguments
     * @returns True if successful, false otherwise
     */
    private async tryExecuteCommand(commandId: string, args?: any): Promise<boolean> {
        try {
            if (args !== undefined) {
                await vscode.commands.executeCommand(commandId, args);
            } else {
                await vscode.commands.executeCommand(commandId);
            }
            return true;
        } catch (error) {
            console.log(`Failed to execute command ${commandId}:`, error);
            return false;
        }
    }

    /**
     * Shows error when Copilot is not available
     */
    private async showCopilotNotAvailableError(): Promise<void> {
        const selection = await vscode.window.showErrorMessage(
            'Could not open Copilot chat. Please ensure GitHub Copilot is installed and enabled.',
            'Install Copilot',
            'Learn More'
        );

        switch (selection) {
            case 'Install Copilot':
                await this.openCopilotExtension();
                break;
            case 'Learn More':
                await this.openCopilotDocs();
                break;
        }
    }

    /**
     * Opens the Copilot extension in the extensions view
     */
    private async openCopilotExtension(): Promise<void> {
        try {
            await vscode.commands.executeCommand('workbench.view.extensions', '@id:github.copilot-chat');
        } catch (error) {
            console.error('Failed to open Copilot extension:', error);
            // Fallback to opening extensions view with search
            await vscode.commands.executeCommand('workbench.view.extensions');
            vscode.window.showInformationMessage('Search for "GitHub Copilot" in the Extensions view');
        }
    }

    /**
     * Opens the Copilot documentation
     */
    private async openCopilotDocs(): Promise<void> {
        const copilotDocsUrl = 'https://docs.github.com/en/copilot/using-github-copilot/getting-started-with-github-copilot';
        await vscode.env.openExternal(vscode.Uri.parse(copilotDocsUrl));
    }

    /**
     * Gets available Copilot commands
     * @returns Array of available command IDs
     */
    async getAvailableCommands(): Promise<string[]> {
        const availableCommands: string[] = [];
        
        for (const commandId of CopilotIntegration.COPILOT_COMMANDS) {
            if (await this.isCommandAvailable(commandId)) {
                availableCommands.push(commandId);
            }
        }
        
        return availableCommands;
    }

    /**
     * Checks if a specific command is available
     * @param commandId Command ID to check
     * @returns True if available, false otherwise
     */
    private async isCommandAvailable(commandId: string): Promise<boolean> {
        try {
            // Get all available commands
            const commands = await vscode.commands.getCommands();
            return commands.includes(commandId);
        } catch {
            return false;
        }
    }

    /**
     * Sends a formatted message with context
     * @param command Slash command (e.g., "/specify", "/plan")
     * @param context Additional context
     * @param userInput User's input
     */
    async sendFormattedMessage(command: string, context?: string, userInput?: string): Promise<void> {
        let message = command;
        
        if (userInput) {
            message += ` ${userInput}`;
        }
        
        if (context) {
            message += `\n\nContext: ${context}`;
        }
        
        await this.sendMessage(message);
    }

    /**
     * Sends a message with spec file context
     * @param message Message to send
     * @param specContent Current spec file content
     */
    async sendMessageWithSpecContext(message: string, specContent?: string): Promise<void> {
        let contextualMessage = message;
        
        if (specContent) {
            contextualMessage += '\n\nCurrent spec.md content:\n```markdown\n' + specContent + '\n```';
        }
        
        await this.sendMessage(contextualMessage);
    }
}