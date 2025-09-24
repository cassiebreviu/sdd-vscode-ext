import * as vscode from 'vscode';
import { ExtensionActivator } from './extensionActivator';

// Global extension activator instance
let extensionActivator: ExtensionActivator | undefined;

/**
 * Called when the extension is activated
 * @param context VS Code extension context
 */
export async function activate(context: vscode.ExtensionContext) {
    try {
        extensionActivator = new ExtensionActivator();
        await extensionActivator.activate(context);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to activate Specify extension: ${error}`);
        console.error('Extension activation failed:', error);
    }
}

/**
 * Called when the extension is deactivated
 */
export function deactivate() {
    if (extensionActivator) {
        extensionActivator.deactivate();
        extensionActivator = undefined;
    }
}