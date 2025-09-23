import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { exec, spawn } from 'child_process';

let retryTimer: NodeJS.Timeout | undefined;


function getSpecPath(): string | undefined {
	const folders = vscode.workspace.workspaceFolders;
	if (folders && folders.length > 0) {
		const specsDir = path.join(folders[0].uri.fsPath, 'specs');
		if (fs.existsSync(specsDir)) {
			const subdirs = fs.readdirSync(specsDir, { withFileTypes: true })
				.filter(dirent => dirent.isDirectory());
			for (const dirent of subdirs) {
				const specPath = path.join(specsDir, dirent.name, 'spec.md');
				if (fs.existsSync(specPath)) {
					return specPath;
				}
			}
		}
	}
	return undefined;
}

class SpecTreeItem extends vscode.TreeItem {
	command?: vscode.Command;
	section: string;
	line: number;
	status?: string; // For implementation items
	constructor(label: string, section: string, line: number, collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None, status?: string) {
		super(label, collapsibleState);
		this.section = section;
		this.line = line;
		this.status = status;
		this.command = {
			command: 'sdd-vscode-ext.openSpecSection',
			title: 'Open Spec Section',
			arguments: [section, line]
		};
	}
}


type SectionType = 'section' | 'subsection';

interface ParsedSection {
    label: string;
    line: number;
    type: SectionType;
    parent?: string;
}


class RequirementsProvider implements vscode.TreeDataProvider<SpecTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SpecTreeItem | undefined | void> = new vscode.EventEmitter<SpecTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<SpecTreeItem | undefined | void> = this._onDidChangeTreeData.event;
    private items: SpecTreeItem[] = [];

    constructor() {
        this.refresh();
    }

    refresh() {
        const specPath = getSpecPath();
        if (specPath) {
            this.items = parseRequirements(specPath);
        } else {
            this.items = [];
        }
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SpecTreeItem): vscode.TreeItem { return element; }
    getChildren(element?: SpecTreeItem): Thenable<SpecTreeItem[]> {
        if (!element) {
            // Top-level sections only
            return Promise.resolve(this.items.filter(item => item.contextValue === 'section'));
        } else if (element.contextValue === 'section') {
            // Subsections for this section
            return Promise.resolve(this.items.filter(item => item.contextValue === 'subsection' && item.section === element.label));
        } else if (element.contextValue === 'subsection') {
            // Subitems for this subsection
            return Promise.resolve(this.items.filter(item => item.contextValue === 'subitem' && item.section === element.label));
        } else {
            return Promise.resolve([]);
        }
    }
}

class ImplementationsProvider implements vscode.TreeDataProvider<SpecTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SpecTreeItem | undefined | void> = new vscode.EventEmitter<SpecTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<SpecTreeItem | undefined | void> = this._onDidChangeTreeData.event;
    private items: SpecTreeItem[] = [];

    constructor() {
        this.refresh();
    }

    refresh() {
        const specPath = getSpecPath();
        if (specPath) {
            this.items = parseImplementations(specPath);
        } else {
            this.items = [];
        }
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SpecTreeItem): vscode.TreeItem { 
        // Add status indicators for implementation items
        if (element.status && element.contextValue === 'subitem') {
            const statusIcon = element.status === 'completed' ? '✓' : element.status === 'in-progress' ? '⏳' : '◯';
            const newElement = new SpecTreeItem(`${statusIcon} ${element.label}`, element.section, element.line, element.collapsibleState, element.status);
            newElement.contextValue = element.contextValue;
            newElement.iconPath = element.iconPath;
            return newElement;
        }
        return element; 
    }
    
    getChildren(element?: SpecTreeItem): Thenable<SpecTreeItem[]> {
        if (!element) {
            // Top-level sections only
            return Promise.resolve(this.items.filter(item => item.contextValue === 'section'));
        } else if (element.contextValue === 'section') {
            // Subsections for this section
            return Promise.resolve(this.items.filter(item => item.contextValue === 'subsection' && item.section === element.label));
        } else if (element.contextValue === 'subsection') {
            // Subitems for this subsection
            return Promise.resolve(this.items.filter(item => item.contextValue === 'subitem' && item.section === element.label));
        } else {
            return Promise.resolve([]);
        }
    }
}

class SpecProvider implements vscode.TreeDataProvider<SpecTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SpecTreeItem | undefined | void> = new vscode.EventEmitter<SpecTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<SpecTreeItem | undefined | void> = this._onDidChangeTreeData.event;
    private items: SpecTreeItem[] = [];

    constructor() {
        this.refresh();
    }

    refresh() {
        const specPath = getSpecPath();
        if (specPath) {
            this.items = parseSpecSections(specPath);
        } else {
            this.items = [];
        }
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SpecTreeItem): vscode.TreeItem { return element; }
    getChildren(element?: SpecTreeItem): Thenable<SpecTreeItem[]> {
        if (!element) {
            // Top-level sections only
            return Promise.resolve(this.items.filter(item => item.contextValue === 'section'));
        } else if (element.contextValue === 'section') {
            // Subsections for this section
            return Promise.resolve(this.items.filter(item => item.contextValue === 'subsection' && item.section === element.label));
        } else if (element.contextValue === 'subsection') {
            // Subitems for this subsection
            return Promise.resolve(this.items.filter(item => item.contextValue === 'subitem' && item.section === element.label));
        } else {
            return Promise.resolve([]);
        }
    }
}

function parseSpecSections(filePath: string): SpecTreeItem[] {
    if (!fs.existsSync(filePath)) return [];
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    const items: SpecTreeItem[] = [];
    let currentSection: string | undefined = undefined;
    let currentSubsection: string | undefined = undefined;
    const sectionSet = new Set<string>();
    const subsectionSet = new Set<string>();
    const subitemSet = new Set<string>();
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match ## Section
        const sectionMatch = line.match(/^##\s+(.+)/);
        if (sectionMatch) {
            currentSection = sectionMatch[1].trim();
            currentSubsection = undefined;
            if (!sectionSet.has(currentSection)) {
                const item = new SpecTreeItem(currentSection, currentSection, i, vscode.TreeItemCollapsibleState.Collapsed);
                item.contextValue = 'section';
                item.iconPath = new vscode.ThemeIcon('symbol-key');
                items.push(item);
                sectionSet.add(currentSection);
            }
            continue;
        }
        // Match ### Subsection
        const subSectionMatch = line.match(/^###\s+(.+)/);
        if (subSectionMatch && currentSection) {
            currentSubsection = subSectionMatch[1].trim();
            const subKey = `${currentSection}::${currentSubsection}`;
            if (!subsectionSet.has(subKey)) {
                const item = new SpecTreeItem(currentSubsection, currentSection, i, vscode.TreeItemCollapsibleState.Collapsed);
                item.contextValue = 'subsection';
                item.iconPath = new vscode.ThemeIcon('symbol-field');
                items.push(item);
                subsectionSet.add(subKey);
            }
            continue;
        }
        // Match items under subsection (bullets, numbers, checklists)
        if (currentSection && currentSubsection) {
            // Bullet, numbered, or checklist item - improved regex to catch all patterns
            if (line.match(/^\s*([-*+]|\d+\.|\[[x ]\])\s+.+/)) {
                let itemLabel = line.replace(/^\s*([-*+]|\d+\.|\[[x ]\])\s*/, '').trim();
                const itemKey = `${currentSection}::${currentSubsection}::${itemLabel}`;
                if (itemLabel && !subitemSet.has(itemKey)) {
                    const item = new SpecTreeItem(itemLabel, currentSubsection, i, vscode.TreeItemCollapsibleState.None);
                    item.contextValue = 'subitem';
                    item.iconPath = new vscode.ThemeIcon('list-unordered');
                    items.push(item);
                    subitemSet.add(itemKey);
                }
            }
        }
    }
    return items;
}

function parseRequirements(filePath: string): SpecTreeItem[] {
    if (!fs.existsSync(filePath)) return [];
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    const items: SpecTreeItem[] = [];
    let currentSection: string | undefined = undefined;
    let currentSubsection: string | undefined = undefined;
    let inRequirementsSection = false;
    const sectionSet = new Set<string>();
    const subsectionSet = new Set<string>();
    const subitemSet = new Set<string>();
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match ## Section
        const sectionMatch = line.match(/^##\s+(.+)/);
        if (sectionMatch) {
            const sectionName = sectionMatch[1].trim();
            // More flexible matching for requirements sections - look for common requirement keywords
            inRequirementsSection = sectionName.toLowerCase().includes('user') || 
                                   sectionName.toLowerCase().includes('scenario') || 
                                   sectionName.toLowerCase().includes('requirement') ||
                                   sectionName.toLowerCase().includes('test') ||
                                   sectionName.toLowerCase().includes('functional');

            if (inRequirementsSection) {
                currentSection = sectionName;
                currentSubsection = undefined;
                if (!sectionSet.has(currentSection)) {
                    const item = new SpecTreeItem(currentSection, currentSection, i, vscode.TreeItemCollapsibleState.Collapsed);
                    item.contextValue = 'section';
                    item.iconPath = new vscode.ThemeIcon('symbol-key');
                    items.push(item);
                    sectionSet.add(currentSection);
                }
            } else {
                currentSection = undefined;
                currentSubsection = undefined;
            }
            continue;
        }

        if (!inRequirementsSection) continue;

        // Match ### Subsection
        const subSectionMatch = line.match(/^###\s+(.+)/);
        if (subSectionMatch && currentSection) {
            currentSubsection = subSectionMatch[1].trim();
            const subKey = `${currentSection}::${currentSubsection}`;
            if (!subsectionSet.has(subKey)) {
                const item = new SpecTreeItem(currentSubsection, currentSection, i, vscode.TreeItemCollapsibleState.Collapsed);
                item.contextValue = 'subsection';
                item.iconPath = new vscode.ThemeIcon('symbol-field');
                items.push(item);
                subsectionSet.add(subKey);
            }
            continue;
        }

        // Match items under subsection (bullets, numbers, checklists) - improved regex
        if (currentSection && currentSubsection) {
            // Bullet, numbered, or checklist item
            if (line.match(/^\s*([-*+]|\d+\.|\[[x ]\])\s+.+/)) {
                let itemLabel = line.replace(/^\s*([-*+]|\d+\.|\[[x ]\])\s*/, '').trim();
                // Remove checkbox syntax from the label for requirements
                itemLabel = itemLabel.replace(/^\[[ x]\]\s*/, '');
                const itemKey = `${currentSection}::${currentSubsection}::${itemLabel}`;
                if (itemLabel && !subitemSet.has(itemKey)) {
                    const item = new SpecTreeItem(itemLabel, currentSubsection, i, vscode.TreeItemCollapsibleState.None);
                    item.contextValue = 'subitem';
                    item.iconPath = new vscode.ThemeIcon('list-unordered');
                    items.push(item);
                    subitemSet.add(itemKey);
                }
            }
        }
    }
    return items;
}

function parseImplementations(filePath: string): SpecTreeItem[] {
    if (!fs.existsSync(filePath)) return [];
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    const items: SpecTreeItem[] = [];
    let currentSection: string | undefined = undefined;
    let currentSubsection: string | undefined = undefined;
    let inImplementationsSection = false;
    const sectionSet = new Set<string>();
    const subsectionSet = new Set<string>();
    const subitemSet = new Set<string>();
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match ## Section
        const sectionMatch = line.match(/^##\s+(.+)/);
        if (sectionMatch) {
            const sectionName = sectionMatch[1].trim();
            // More flexible matching for implementation sections - look for common implementation keywords
            inImplementationsSection = sectionName.toLowerCase().includes('review') || 
                                     sectionName.toLowerCase().includes('acceptance') || 
                                     sectionName.toLowerCase().includes('checklist') ||
                                     sectionName.toLowerCase().includes('implementation') ||
                                     sectionName.toLowerCase().includes('development') ||
                                     sectionName.toLowerCase().includes('task');

            if (inImplementationsSection) {
                currentSection = sectionName;
                currentSubsection = undefined;
                if (!sectionSet.has(currentSection)) {
                    const item = new SpecTreeItem(currentSection, currentSection, i, vscode.TreeItemCollapsibleState.Collapsed);
                    item.contextValue = 'section';
                    item.iconPath = new vscode.ThemeIcon('symbol-key');
                    items.push(item);
                    sectionSet.add(currentSection);
                }
            } else {
                currentSection = undefined;
                currentSubsection = undefined;
            }
            continue;
        }

        if (!inImplementationsSection) continue;

        // Match ### Subsection
        const subSectionMatch = line.match(/^###\s+(.+)/);
        if (subSectionMatch && currentSection) {
            currentSubsection = subSectionMatch[1].trim();
            const subKey = `${currentSection}::${currentSubsection}`;
            if (!subsectionSet.has(subKey)) {
                const item = new SpecTreeItem(currentSubsection, currentSection, i, vscode.TreeItemCollapsibleState.Collapsed);
                item.contextValue = 'subsection';
                item.iconPath = new vscode.ThemeIcon('symbol-field');
                items.push(item);
                subsectionSet.add(subKey);
            }
            continue;
        }

        // Match items under subsection (bullets, numbers, checklists) - improved regex
        if (currentSection && currentSubsection) {
            // Bullet, numbered, or checklist item
            if (line.match(/^\s*([-*+]|\d+\.|\[[x ]\])\s+.+/)) {
                let itemLabel = line.replace(/^\s*([-*+]|\d+\.|\[[x ]\])\s*/, '').trim();
                // Determine status from checkbox syntax - check for checkbox anywhere in the content
                let status = 'pending';
                const checkboxMatch = itemLabel.match(/^\[([x ])\]/);
                if (checkboxMatch) {
                    status = checkboxMatch[1] === 'x' ? 'completed' : 'pending';
                    // Remove checkbox syntax from the label for implementations  
                    itemLabel = itemLabel.replace(/^\[[ x]\]\s*/, '');
                }
                const itemKey = `${currentSection}::${currentSubsection}::${itemLabel}`;
                if (itemLabel && !subitemSet.has(itemKey)) {
                    const item = new SpecTreeItem(itemLabel, currentSubsection, i, vscode.TreeItemCollapsibleState.None, status);
                    item.contextValue = 'subitem';
                    item.iconPath = new vscode.ThemeIcon(status === 'completed' ? 'check' : 'circle-outline');
                    items.push(item);
                    subitemSet.add(itemKey);
                }
            }
        }
    }
    return items;
}

class ActionsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!element) {
            return Promise.resolve([
                this.createActionItem('1. Start Specify', 'Create a new specification file', 'sdd-vscode-ext.startProject', 'plus'),
                this.createActionItem('2. Prompt - Specify Feature/App', 'Send custom specification to Copilot', 'sdd-vscode-ext.specifyCommand', 'lightbulb'),
                this.createActionItem('3. Plan - Define Tech Stack', 'Command to provide your tech stack and architecture choices.', 'sdd-vscode-ext.planCommand', 'wand'),
                this.createActionItem('4. Tasks - Actionable Task List', 'Create actionable task list from implementation plan', 'sdd-vscode-ext.tasksCommand', 'checklist'),
                this.createActionItem('5. Implement - Create the Feature/App', 'Execute /implement slash command in Copilot', 'sdd-vscode-ext.implementSpecRocket', 'rocket')
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

    refresh() {
        this._onDidChangeTreeData.fire();
    }
}

export function activate(context: vscode.ExtensionContext) {
    // Command to start a new project using SDD CLI
    context.subscriptions.push(
        vscode.commands.registerCommand('sdd-vscode-ext.startProject', async () => {
            vscode.window.showInformationMessage('Starting SDD project in this folder...');
            // Check if uvx is installed
            exec('which uvx', (whichError, whichStdout, whichStderr) => {
                if (whichError || !whichStdout.trim()) {
                    vscode.window.showInformationMessage('uvx not found. Installing uvx...');
                    exec('pipx install uv', (pipxError, pipxStdout, pipxStderr) => {
                        if (pipxError) {
                            vscode.window.showErrorMessage('Failed to install uvx using pipx. Please install uvx manually: https://docs.astral.sh/uv/getting-started/installation/');
                            console.error('pipx install uv error:', pipxError);
                            return;
                        }
                        vscode.window.showInformationMessage('uvx installed successfully! Running SDD project initialization...');
                        runUvxCommand();
                    });
                } else {
                    runUvxCommand();
                }
            });

            function runUvxCommand() {
                const outputChannel = vscode.window.createOutputChannel('SDD CLI Output');
                outputChannel.show(true);
                const args = ['--from', 'git+https://github.com/github/spec-kit.git', 'specify', 'init', '--here', '--ai', 'copilot','--force'];
                outputChannel.appendLine(`Running: uvx ${args.join(' ')}`);
                // Set cwd to the current workspace folder
                const folders = vscode.workspace.workspaceFolders;
                const cwd = folders && folders.length > 0 ? folders[0].uri.fsPath : process.cwd();
                const child = spawn('uvx', args, { shell: true, cwd });

                let buffer = '';
                child.stdout.on('data', async (data) => {
                    const text = data.toString();
                    outputChannel.append(text);
                    buffer += text;
                    // Detect prompt (simple heuristic: line ends with ? or : or >)
                    const lines = buffer.split(/\r?\n/);
                    const lastLine = lines[lines.length - 2] || lines[lines.length - 1];
                    if (/\?\s*$|:\s*$|>\s*$/.test(lastLine)) {
                        buffer = '';
                        const userInput = await vscode.window.showInputBox({ prompt: lastLine.trim() });
                        if (userInput !== undefined) {
                            child.stdin.write(userInput + '\n');
                            outputChannel.appendLine(`> ${userInput}`);
                        }
                    }
                });
                child.stderr.on('data', (data) => {
                    outputChannel.append(data.toString());
                });
                child.on('error', (error) => {
                    vscode.window.showErrorMessage(`Failed to start SDD project: ${error.message}`);
                    outputChannel.appendLine(`ERROR: ${error.message}`);
                    outputChannel.appendLine(error.stack || '');
                });
                child.on('close', (code) => {
                    if (code === 0) {
                        vscode.window.showInformationMessage('SDD project started successfully!');
                    } else {
                        vscode.window.showErrorMessage(`SDD project process exited with code ${code}`);
                        outputChannel.appendLine(`Process exited with code ${code}`);
                    }
                });
            }
        })
    );

    // Reparse spec.md after each save
    let provider: SpecProvider | undefined;
    let requirementsProvider: RequirementsProvider | undefined;
    let implementationsProvider: ImplementationsProvider | undefined;
    let actionsProvider: ActionsProvider | undefined;
    
    // Register Actions provider immediately (doesn't depend on spec files)
    actionsProvider = new ActionsProvider();
    vscode.window.registerTreeDataProvider('actionsView', actionsProvider);
    
    function refreshAllProviders() {
        if (provider) provider.refresh();
        if (requirementsProvider) requirementsProvider.refresh();
        if (implementationsProvider) implementationsProvider.refresh();
        if (actionsProvider) actionsProvider.refresh();
    }
    
    vscode.workspace.onDidSaveTextDocument((doc) => {
        const specPath = getSpecPath();
        if (specPath && doc.uri.fsPath === specPath) {
            refreshAllProviders();
            vscode.window.showInformationMessage('spec.md reparsed after save!');
        }
    });

    async function waitForSpecAndParse() {
        let specPath;
        for (let i = 0; i < 20; i++) { // Try for up to ~10 seconds
            specPath = getSpecPath();
            if (specPath && fs.existsSync(specPath)) {
                vscode.window.showInformationMessage('spec.md found and parsed!');
                break;
            }
            await new Promise(res => setTimeout(res, 500));
        }

        if (!specPath || !fs.existsSync(specPath)) {
            // Start 1-minute retry mechanism
            function scheduleRetry() {
                retryTimer = setTimeout(async () => {
                    const newSpecPath = getSpecPath();
                    if (newSpecPath && fs.existsSync(newSpecPath)) {
                        vscode.window.showInformationMessage('spec.md found and parsed!');
                        if (!provider) {
                            // Initialize providers if they haven't been created yet
                            provider = new SpecProvider();
                            requirementsProvider = new RequirementsProvider();
                            implementationsProvider = new ImplementationsProvider();

                            vscode.window.registerTreeDataProvider('specNavigationView', provider);
                            vscode.window.registerTreeDataProvider('requirementsView', requirementsProvider);
                            vscode.window.registerTreeDataProvider('implementationsView', implementationsProvider);
                            setupFileWatcher();
                        } else {
                            // Only refresh existing providers
                            refreshAllProviders();
                        }
                    } else {
                        scheduleRetry(); // Continue retrying
                    }
                }, 1 * 60 * 1000); // 1 minute
            }
            scheduleRetry();
            return;
        }

        // Only register providers if not already registered
        if (!provider) {
            provider = new SpecProvider();
            requirementsProvider = new RequirementsProvider();
            implementationsProvider = new ImplementationsProvider();

            vscode.window.registerTreeDataProvider('specNavigationView', provider);
            vscode.window.registerTreeDataProvider('requirementsView', requirementsProvider);
            vscode.window.registerTreeDataProvider('implementationsView', implementationsProvider);
            setupFileWatcher();
        } else {
            refreshAllProviders();
        }
    }
    
    function setupFileWatcher() {
        // Watch spec.md for changes in the specs directory structure
        let specFolder = undefined;
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            specFolder = folders[0].uri.fsPath;
        }
        if (specFolder) {
            // Watch for spec.md files in the specs directory and subdirectories
            const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(specFolder, '**/spec.md'));
            watcher.onDidChange(() => {
                refreshAllProviders();
                vscode.window.showInformationMessage('spec.md re-parsed!');
            });
            watcher.onDidCreate(() => {
                refreshAllProviders();
                vscode.window.showInformationMessage('spec.md re-parsed!');
            });
            watcher.onDidDelete(() => {
                refreshAllProviders();
                vscode.window.showErrorMessage('spec.md deleted from workspace.');
            });
            context.subscriptions.push(watcher);
        }
    }
    waitForSpecAndParse();

    // Command to manually reparse spec
    context.subscriptions.push(
        vscode.commands.registerCommand('sdd-vscode-ext.reparseSpec', async () => {
            // Clear existing retry timer
            if (retryTimer) {
                clearTimeout(retryTimer);
                retryTimer = undefined;
            }

            const specPath = getSpecPath();
            if (!specPath || !fs.existsSync(specPath)) {
                vscode.window.showErrorMessage('spec.md not found in workspace. Please add spec.md to your project.');
                // Restart the retry mechanism
                waitForSpecAndParse();
                return;
            }

            // Only refresh providers, do not re-register or re-create them
            refreshAllProviders();
            vscode.window.showInformationMessage('spec.md manually reparsed!');
        })
    );

    // Command to open spec.md at the right line
    context.subscriptions.push(
        vscode.commands.registerCommand('sdd-vscode-ext.openSpecSection', async (section: string, line: number) => {
            const specPath = getSpecPath();
            if (!specPath) {
                vscode.window.showErrorMessage('spec.md not found in workspace.');
                return;
            }
            const doc = await vscode.workspace.openTextDocument(specPath);
            const editor = await vscode.window.showTextDocument(doc, { preview: false });
            const pos = new vscode.Position(line, 0);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
            editor.selection = new vscode.Selection(pos, pos);
        })
    );

    // Helper function to send messages to Copilot
    async function sendToCopilot(message: string) {
        try {
            // Try the newest chat API first
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                query: message
            });
        } catch (error) {
            try {
                // Fallback to Copilot-specific commands
                await vscode.commands.executeCommand('github.copilot.chat.newChatFromSelection', {
                    message: message
                });
            } catch (fallbackError) {
                try {
                    // Alternative Copilot command
                    await vscode.commands.executeCommand('github.copilot.chat.newChat', message);
                } catch (secondFallbackError) {
                    try {
                        // Last resort: just open the chat panel
                        await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
                        vscode.window.showInformationMessage(`Copilot chat opened. Please ask: "${message}"`);
                    } catch (finalError) {
                        // Show helpful error
                        vscode.window.showErrorMessage(
                            'Could not open Copilot chat. Please ensure GitHub Copilot is installed and enabled.',
                            'Install Copilot'
                        ).then(selection => {
                            if (selection === 'Install Copilot') {
                                vscode.commands.executeCommand('workbench.view.extensions', '@id:github.copilot-chat');
                            }
                        });
                    }
                }
            }
        }
    }

        // Command for /tasks slash command (no input required)
    context.subscriptions.push(
        vscode.commands.registerCommand('sdd-vscode-ext.tasksCommand', async () => {
            const tasksCommand = '/tasks';
            await sendToCopilot(tasksCommand);
        })
    );

        // Command for rocket icon button to implement the spec
        context.subscriptions.push(
            vscode.commands.registerCommand('sdd-vscode-ext.implementSpecRocket', async () => {
                await sendToCopilot('/implement');
            })
        );    // Command for /specify slash command with user input
    context.subscriptions.push(
        vscode.commands.registerCommand('sdd-vscode-ext.specifyCommand', async () => {
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
                await sendToCopilot(specifyCommand);
            }
        })
    );

    // Command for /plan slash command with user input
    context.subscriptions.push(
        vscode.commands.registerCommand('sdd-vscode-ext.planCommand', async () => {
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
                await sendToCopilot(planCommand);
            }
        })
    );


}

export function deactivate() {
    // Clean up retry timer
    if (retryTimer) {
        clearTimeout(retryTimer);
    }
}