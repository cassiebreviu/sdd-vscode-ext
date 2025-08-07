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
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match ## Section
        const sectionMatch = line.match(/^##\s+(.+)/);
        if (sectionMatch) {
            currentSection = sectionMatch[1].trim();
            currentSubsection = undefined;
            const item = new SpecTreeItem(currentSection, currentSection, i, vscode.TreeItemCollapsibleState.Collapsed);
            item.contextValue = 'section';
            item.iconPath = new vscode.ThemeIcon('symbol-key');
            items.push(item);
            continue;
        }
        // Match ### Subsection
        const subSectionMatch = line.match(/^###\s+(.+)/);
        if (subSectionMatch && currentSection) {
            currentSubsection = subSectionMatch[1].trim();
            const item = new SpecTreeItem(currentSubsection, currentSection, i, vscode.TreeItemCollapsibleState.Collapsed);
            item.contextValue = 'subsection';
            item.iconPath = new vscode.ThemeIcon('symbol-field');
            items.push(item);
            continue;
        }
        // Match items under subsection (bullets, numbers, checklists)
        if (currentSection && currentSubsection) {
            // Bullet, numbered, or checklist item
            if (line.match(/^\s*([-*]|[x ]?[\[\]]|(\d+\.)?)\s+.+/)) {
                const itemLabel = line.replace(/^\s*([-*]|[x ]?[\[\]]|(\d+\.)?)\s+/, '').trim();
                if (itemLabel) {
                    const item = new SpecTreeItem(itemLabel, currentSubsection, i, vscode.TreeItemCollapsibleState.None);
                    item.contextValue = 'subitem';
                    item.iconPath = new vscode.ThemeIcon('list-unordered');
                    items.push(item);
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
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Match ## Section
        const sectionMatch = line.match(/^##\s+(.+)/);
        if (sectionMatch) {
            const sectionName = sectionMatch[1].trim();
            // Check if this is the User Scenarios & Testing section
            inRequirementsSection = sectionName.toLowerCase().includes('user scenarios') && sectionName.toLowerCase().includes('testing');
            
            if (inRequirementsSection) {
                currentSection = sectionName;
                currentSubsection = undefined;
                const item = new SpecTreeItem(currentSection, currentSection, i, vscode.TreeItemCollapsibleState.Collapsed);
                item.contextValue = 'section';
                item.iconPath = new vscode.ThemeIcon('symbol-key');
                items.push(item);
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
            const item = new SpecTreeItem(currentSubsection, currentSection, i, vscode.TreeItemCollapsibleState.Collapsed);
            item.contextValue = 'subsection';
            item.iconPath = new vscode.ThemeIcon('symbol-field');
            items.push(item);
            continue;
        }
        
        // Match items under subsection (bullets, numbers, checklists)
        if (currentSection && currentSubsection) {
            // Bullet, numbered, or checklist item
            if (line.match(/^\s*([-*]|[x ]?[\[\]]|(\d+\.)?)\s+.+/)) {
                let itemLabel = line.replace(/^\s*([-*]|[x ]?[\[\]]|(\d+\.)?)\s+/, '').trim();
                // Remove checkbox syntax from the label for requirements
                itemLabel = itemLabel.replace(/^\[[ x]\]\s*/, '');
                if (itemLabel) {
                    const item = new SpecTreeItem(itemLabel, currentSubsection, i, vscode.TreeItemCollapsibleState.None);
                    item.contextValue = 'subitem';
                    item.iconPath = new vscode.ThemeIcon('list-unordered');
                    items.push(item);
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
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Match ## Section
        const sectionMatch = line.match(/^##\s+(.+)/);
        if (sectionMatch) {
            const sectionName = sectionMatch[1].trim();
            // Check if this is the Review & Acceptance Checklist section
            inImplementationsSection = sectionName.toLowerCase().includes('review') && 
                                     sectionName.toLowerCase().includes('acceptance') && 
                                     sectionName.toLowerCase().includes('checklist');
            
            if (inImplementationsSection) {
                currentSection = sectionName;
                currentSubsection = undefined;
                const item = new SpecTreeItem(currentSection, currentSection, i, vscode.TreeItemCollapsibleState.Collapsed);
                item.contextValue = 'section';
                item.iconPath = new vscode.ThemeIcon('symbol-key');
                items.push(item);
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
            const item = new SpecTreeItem(currentSubsection, currentSection, i, vscode.TreeItemCollapsibleState.Collapsed);
            item.contextValue = 'subsection';
            item.iconPath = new vscode.ThemeIcon('symbol-field');
            items.push(item);
            continue;
        }
        
        // Match items under subsection (bullets, numbers, checklists)
        if (currentSection && currentSubsection) {
            // Bullet, numbered, or checklist item
            if (line.match(/^\s*([-*]|[x ]?[\[\]]|(\d+\.)?)\s+.+/)) {
                let itemLabel = line.replace(/^\s*([-*]|[x ]?[\[\]]|(\d+\.)?)\s+/, '').trim();
                // Determine status from checkbox syntax
                let status = 'pending';
                const checkboxMatch = itemLabel.match(/^\[([x ])\]/);
                if (checkboxMatch) {
                    status = checkboxMatch[1] === 'x' ? 'completed' : 'pending';
                    // Remove checkbox syntax from the label for implementations  
                    itemLabel = itemLabel.replace(/^\[[ x]\]\s*/, '');
                }
                
                if (itemLabel) {
                    const item = new SpecTreeItem(itemLabel, currentSubsection, i, vscode.TreeItemCollapsibleState.None, status);
                    item.contextValue = 'subitem';
                    item.iconPath = new vscode.ThemeIcon(status === 'completed' ? 'check' : 'circle-outline');
                    items.push(item);
                }
            }
        }
    }
    return items;
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
                const args = ['--from', 'git+https://github.com/localden/sdd.git', 'specify', 'init', '--here', '--ai', 'copilot'];
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
    
    function refreshAllProviders() {
        if (provider) provider.refresh();
        if (requirementsProvider) requirementsProvider.refresh();
        if (implementationsProvider) implementationsProvider.refresh();
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
            vscode.window.showErrorMessage('spec.md not found in workspace. Will retry every 1 minute. Please add spec.md to your project.');
            
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
                        } else {
                            // Refresh existing providers
                            refreshAllProviders();
                        }
                        setupFileWatcher(); // Setup file watcher for the found spec
                    } else {
                        scheduleRetry(); // Continue retrying
                    }
                }, 1 * 60 * 1000); // 1 minute
            }
            scheduleRetry();
            return;
        }
        
        // Register all tree data providers
        provider = new SpecProvider();
        requirementsProvider = new RequirementsProvider();
        implementationsProvider = new ImplementationsProvider();
        
        vscode.window.registerTreeDataProvider('specNavigationView', provider);
        vscode.window.registerTreeDataProvider('requirementsView', requirementsProvider);
        vscode.window.registerTreeDataProvider('implementationsView', implementationsProvider);

        setupFileWatcher();
    }
    
    function setupFileWatcher() {
        // Watch spec.md for changes
        let specFolder = undefined;
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            specFolder = folders[0].uri.fsPath;
        }
        if (specFolder) {
            const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(specFolder, 'spec.md'));
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
            
            // Initialize providers if they don't exist yet
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
}

export function deactivate() {
    // Clean up retry timer
    if (retryTimer) {
        clearTimeout(retryTimer);
    }
}
