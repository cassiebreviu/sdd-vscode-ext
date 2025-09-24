import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { ICommandManager, ICopilotIntegration, ISpecFileManager, Runner } from './types';

/**
 * Manages all extension commands and their execution
 */
export class CommandManager implements ICommandManager {
    private specFileManager: ISpecFileManager;
    private copilotIntegration: ICopilotIntegration;
    private outputChannel: vscode.OutputChannel;

    constructor(specFileManager: ISpecFileManager, copilotIntegration: ICopilotIntegration) {
        this.specFileManager = specFileManager;
        this.copilotIntegration = copilotIntegration;
        this.outputChannel = vscode.window.createOutputChannel('SDD CLI Output');
    }

    /**
     * Registers all commands with the extension context
     * @param context VS Code extension context
     */
    registerCommands(context: vscode.ExtensionContext): void {
        const commands = [
            { name: 'sdd-vscode-ext.startProject', handler: () => this.executeStartProject() },
            { name: 'sdd-vscode-ext.specifyCommand', handler: () => this.executeSpecifyCommand() },
            { name: 'sdd-vscode-ext.planCommand', handler: () => this.executePlanCommand() },
            { name: 'sdd-vscode-ext.tasksCommand', handler: () => this.executeTasksCommand() },
            { name: 'sdd-vscode-ext.implementSpecRocket', handler: () => this.executeImplementCommand() },
            { name: 'sdd-vscode-ext.openSpecSection', handler: (section: string, line: number) => this.openSpecSection(section, line) },
            { name: 'sdd-vscode-ext.reparseSpec', handler: () => this.reparseSpec() }
        ];

        commands.forEach(cmd => {
            const disposable = vscode.commands.registerCommand(cmd.name, cmd.handler);
            context.subscriptions.push(disposable);
        });
    }

    /**
     * Executes the start project command
     */
    async executeStartProject(): Promise<void> {
        vscode.window.showInformationMessage('Starting SDD project in this folder...');
        this.outputChannel.show(true);

        try {
            const runner = await this.resolveRunner();
            if (!runner) {
                this.showInstallHelp();
                return;
            }
            
            await this.runSpecifyCommand(runner);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start SDD project: ${error}`);
            this.outputChannel.appendLine(`ERROR: ${error}`);
        }
    }

    /**
     * Executes the specify command with user input
     */
    async executeSpecifyCommand(): Promise<void> {
        const userInput = await vscode.window.showInputBox({
            prompt: 'Enter your specification request',
            placeHolder: 'e.g., create a login form, add error handling, implement user authentication...',
            title: 'Specify Command Input',
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Please enter a specification request';
                }
                return null;
            }
        });

        if (userInput && userInput.trim()) {
            const specifyCommand = `/specify ${userInput.trim()}`;
            await this.copilotIntegration.sendMessage(specifyCommand);
        }
    }

    /**
     * Executes the plan command with user input
     */
    async executePlanCommand(): Promise<void> {
        const userInput = await vscode.window.showInputBox({
            prompt: 'Enter your planning request',
            placeHolder: 'e.g., plan the architecture for user auth, create a project roadmap, outline testing strategy...',
            title: 'Plan Command Input',
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Please enter a planning request';
                }
                return null;
            }
        });

        if (userInput && userInput.trim()) {
            const planCommand = `/plan ${userInput.trim()}`;
            await this.copilotIntegration.sendMessage(planCommand);
        }
    }

    /**
     * Executes the tasks command
     */
    async executeTasksCommand(): Promise<void> {
        await this.copilotIntegration.sendMessage('/tasks');
    }

    /**
     * Executes the implement command
     */
    async executeImplementCommand(): Promise<void> {
        await this.copilotIntegration.sendMessage('/implement');
    }

    /**
     * Opens a specific section in the spec file
     * @param section Section name
     * @param line Line number
     */
    private async openSpecSection(section: string, line: number): Promise<void> {
        const specPath = this.specFileManager.getSpecPath();
        if (!specPath) {
            vscode.window.showErrorMessage('spec.md not found in workspace.');
            return;
        }

        try {
            const doc = await vscode.workspace.openTextDocument(specPath);
            const editor = await vscode.window.showTextDocument(doc, { preview: false });
            const pos = new vscode.Position(line, 0);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
            editor.selection = new vscode.Selection(pos, pos);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open spec section: ${error}`);
        }
    }

    /**
     * Reparses the spec file
     */
    private async reparseSpec(): Promise<void> {
        const specPath = this.specFileManager.getSpecPath();
        if (!specPath || !this.specFileManager.exists()) {
            vscode.window.showErrorMessage('spec.md not found in workspace. Please add spec.md to your project.');
            return;
        }

        vscode.window.showInformationMessage('spec.md manually reparsed!');
    }

    /**
     * Resolves the appropriate runner (uvx or uv)
     * @returns Runner configuration or undefined if neither is available
     */
    private async resolveRunner(): Promise<Runner | undefined> {
        if (await this.tryCommand('uvx')) {
            return { cmd: 'uvx', argsPrefix: [] };
        }
        if (await this.tryCommand('uv')) {
            return { cmd: 'uv', argsPrefix: ['tool', 'run'] };
        }
        return undefined;
    }

    /**
     * Tests if a command is available
     * @param cmd Command to test
     * @returns True if command is available, false otherwise
     */
    private tryCommand(cmd: string): Promise<boolean> {
        return new Promise(resolve => {
            const child = spawn(cmd, ['--version'], { shell: true });
            let resolved = false;
            
            child.on('error', () => {
                if (!resolved) {
                    resolved = true;
                    resolve(false);
                }
            });
            
            child.on('exit', code => {
                if (!resolved) {
                    resolved = true;
                    resolve(code === 0);
                }
            });
        });
    }

    /**
     * Shows help for installing uv
     */
    private showInstallHelp(): void {
        const platform = process.platform;
        const installCommands = {
            darwin: 'brew install uv',
            linux: 'curl -LsSf https://astral.sh/uv/install.sh | sh',
            win32: 'powershell -c "irm https://astral.sh/uv/install.ps1 | iex"'
        };
        
        const suggestion = installCommands[platform as keyof typeof installCommands] || installCommands.linux;

        vscode.window.showErrorMessage(
            'uv (uvx) not found. Install it first – opening instructions.',
            'Open Docs',
            'Copy Install Command'
        ).then(selection => {
            if (selection === 'Open Docs') {
                vscode.env.openExternal(vscode.Uri.parse('https://docs.astral.sh/uv/getting-started/installation/'));
            } else if (selection === 'Copy Install Command') {
                vscode.env.clipboard.writeText(suggestion);
                vscode.window.showInformationMessage('Install command copied to clipboard. Paste it in your terminal, then re-run Start Specify.');
            }
        });

        this.outputChannel.appendLine('uv not detected. Please install following official instructions:');
        this.outputChannel.appendLine('Docs: https://docs.astral.sh/uv/getting-started/installation/');
        this.outputChannel.appendLine(`Suggested command for this platform: ${suggestion}`);
        
        if (platform === 'win32') {
            this.outputChannel.appendLine('');
            this.outputChannel.appendLine('Windows Users: If you encounter Unicode errors, try:');
            this.outputChannel.appendLine('1. Run PowerShell as Administrator');
            this.outputChannel.appendLine('2. Set UTF-8 encoding: chcp 65001');
            this.outputChannel.appendLine('3. Or use Windows Terminal instead of Command Prompt');
        }
    }

   

    /**
     * Runs the specify init command
     * @param runner Runner configuration
     */
    private async runSpecifyCommand(runner: Runner): Promise<void> {
        const baseArgs = [
            '--from', 'git+https://github.com/github/spec-kit.git',
            'specify', 'init', '--here', '--ai', 'copilot', '--force'
        ];
        const args = [...runner.argsPrefix, ...baseArgs];
        
        this.outputChannel.appendLine(`Running: ${runner.cmd} ${args.join(' ')}`);
        
        const workspaceRoot = this.specFileManager.getWorkspaceRoot();
        const cwd = workspaceRoot || process.cwd();
        
        // Set up environment to handle Unicode properly on Windows
        const env: NodeJS.ProcessEnv = { 
            ...process.env,
            PYTHONIOENCODING: 'utf-8',
            PYTHONLEGACYWINDOWSSTDIO: '1',
            LC_ALL: 'en_US.UTF-8',
            LANG: 'en_US.UTF-8'
        };
        
        // On Windows, also set console codepage for better Unicode support
        if (process.platform === 'win32') {
            env.CHCP = '65001';
        }
        
        return new Promise((resolve, reject) => {
            const child = spawn(runner.cmd, args, { 
                shell: true, 
                cwd,
                env,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let buffer = '';

            child.stdout.on('data', async (data) => {
                const text = data.toString('utf8');
                this.outputChannel.append(text);
                buffer += text;

                // Handle interactive prompts
                const lines = buffer.split(/\r?\n/);
                const lastLine = lines[lines.length - 2] || lines[lines.length - 1];
                
                if (/\?\s*$|:\s*$|>\s*$/.test(lastLine)) {
                    buffer = '';
                    const userInput = await vscode.window.showInputBox({ 
                        prompt: lastLine.trim() 
                    });
                    
                    if (userInput !== undefined) {
                        child.stdin.write(userInput + '\n', 'utf8');
                        this.outputChannel.appendLine(`> ${userInput}`);
                    }
                }
            });

            child.stderr.on('data', (data) => {
                const text = data.toString('utf8');
                this.outputChannel.append(`STDERR: ${text}`);
            });

            child.on('error', (error) => {
                let errorMessage = `Failed to start SDD project: ${error.message}`;
                
                // Check for common Unicode/encoding issues on Windows
                if (error.message.includes('UnicodeEncodeError') || 
                    error.message.includes('charmap') || 
                    error.message.includes('codec')) {
                    
                    errorMessage += '\n\nThis appears to be a Unicode encoding issue on Windows.';
                    
                    vscode.window.showErrorMessage(
                        'Unicode encoding error detected. Try the suggested fixes.',
                        'Show Fixes',
                        'Open Terminal'
                    ).then(selection => {
                        if (selection === 'Show Fixes') {
                            this.showUnicodeFixHelp();
                        } else if (selection === 'Open Terminal') {
                            vscode.commands.executeCommand('workbench.action.terminal.new');
                        }
                    });
                } else {
                    vscode.window.showErrorMessage(errorMessage);
                }
                
                this.outputChannel.appendLine(`ERROR: ${error.message}`);
                reject(error);
            });

            child.on('close', (code) => {
                if (code === 0) {
                    vscode.window.showInformationMessage('SDD project started successfully!');
                    resolve();
                } else {
                    const errorMessage = `SDD project process exited with code ${code}`;
                    vscode.window.showErrorMessage(errorMessage);
                    this.outputChannel.appendLine(`Process exited with code ${code}`);
                    reject(new Error(errorMessage));
                }
            });
        });
    }

    /**
     * Shows help for Unicode encoding issues on Windows
     */
    private showUnicodeFixHelp(): void {
        const message = `Unicode Encoding Fix for Windows:

1. **Use Windows Terminal** (recommended):
   - Install Windows Terminal from Microsoft Store
   - It has better Unicode support than Command Prompt

2. **Set UTF-8 in Command Prompt**:
   - Open Command Prompt as Administrator
   - Run: chcp 65001
   - Then retry the operation

3. **PowerShell Alternative**:
   - Use PowerShell instead of Command Prompt
   - Run: [Console]::OutputEncoding = [System.Text.Encoding]::UTF8

4. **VS Code Terminal Settings**:
   - Go to Settings > Terminal > Integrated: Shell Args
   - Add encoding arguments for your shell

5. **Environment Variables**:
   - Set PYTHONIOENCODING=utf-8
   - Set PYTHONLEGACYWINDOWSSTDIO=1

The extension has already set these environment variables, but your system terminal might need manual configuration.`;

        vscode.window.showInformationMessage(
            'Unicode encoding fixes available in output channel.',
            'View Fixes'
        ).then(selection => {
            if (selection === 'View Fixes') {
                this.outputChannel.show(true);
                this.outputChannel.appendLine('='.repeat(60));
                this.outputChannel.appendLine('UNICODE ENCODING TROUBLESHOOTING');
                this.outputChannel.appendLine('='.repeat(60));
                this.outputChannel.appendLine(message);
                this.outputChannel.appendLine('='.repeat(60));
            }
        });
    }

    /**
     * Disposes of resources
     */
    dispose(): void {
        this.outputChannel.dispose();
    }
}