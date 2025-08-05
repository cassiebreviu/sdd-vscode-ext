

import * as fs from 'fs';
import * as path from 'path';

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

import * as vscode from 'vscode';

class SpecTreeItem extends vscode.TreeItem {
	command?: vscode.Command;
	section: string;
	line: number;
	constructor(label: string, section: string, line: number, collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None) {
		super(label, collapsibleState);
		this.section = section;
		this.line = line;
		this.command = {
			command: 'sdd-vscode-ext.openSpecSection',
			title: 'Open Spec Section',
			arguments: [section, line]
		};
	}
// ...existing code...
}

class SpecProvider implements vscode.TreeDataProvider<SpecTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<SpecTreeItem | undefined | void> = new vscode.EventEmitter<SpecTreeItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<SpecTreeItem | undefined | void> = this._onDidChangeTreeData.event;
	private items: SpecTreeItem[] = [];

	constructor(private section: string) {
		this.refresh();
	}

		refresh() {
			const specPath = getSpecPath();
			if (specPath) {
				this.items = parseSpecSection(specPath, this.section);
			} else {
				this.items = [];
			}
			this._onDidChangeTreeData.fire();
		}

	getTreeItem(element: SpecTreeItem): vscode.TreeItem { return element; }
	getChildren(): Thenable<SpecTreeItem[]> { return Promise.resolve(this.items); }
}

function parseSpecSection(filePath: string, section: string): SpecTreeItem[] {
	if (!fs.existsSync(filePath)) return [];
	const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
	const items: SpecTreeItem[] = [];
	let inSection = false;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.match(new RegExp(`^##+ ${section}`))) {
			inSection = true;
			continue;
		}
		if (inSection && line.startsWith('##')) break;
		if (inSection) {
			// Only parse requirements in requirements section
			if (section === 'Requirements *(mandatory)*' && line.match(/^\s*- \*\*(FR-[0-9]+)\*\*: (.+)$/)) {
				const match = line.match(/^\s*- \*\*(FR-[0-9]+)\*\*: (.+)$/);
				if (match) {
					let label = `${match[1]}: ${match[2]}`;
					let status = 'Defined';
					if (label.includes('[NEEDS CLARIFICATION')) status = 'Needs Clarification';
					const item = new SpecTreeItem(label, section, i);
					item.contextValue = 'requirementItem';
					item.description = status;
					item.iconPath = new vscode.ThemeIcon(
						status === 'Needs Clarification' ? 'question' : 'checklist'
					);
					items.push(item);
				}
			}
			// Only parse todos in todos section
			if (section === 'TODOS' && line.match(/^- \[([ x~])\] (.+)$/)) {
				const match = line.match(/^- \[([ x~])\] (.+)$/);
				if (match) {
					let status: 'Pending' | 'In Progress' | 'Completed';
					if (match[1] === 'x') status = 'Completed';
					else if (match[1] === '~') status = 'In Progress';
					else status = 'Pending';
					const item = new SpecTreeItem(`${match[2]}`, 'Review & Acceptance Checklist', i);
					item.contextValue = 'todoItem';
					item.description = status;
					item.iconPath = new vscode.ThemeIcon(
						status === 'Completed' ? 'check' : status === 'In Progress' ? 'sync' : 'circle-outline'
					);
					items.push(item);
				}
			}
			// Only parse key entities in requirements section
			if (section === 'Requirements *(mandatory)*' && line.match(/^\s*- \*\*(GroceryItem|GroceryList)\*\*: (.+)$/)) {
				const match = line.match(/^\s*- \*\*(GroceryItem|GroceryList)\*\*: (.+)$/);
				if (match) items.push(new SpecTreeItem(`${match[1]}: ${match[2]}`, section, i));
			}
			// Only parse execution status in Implementation section
			if (section === 'Implementation' && line.match(/^- \[([ x~])\] (.+)$/)) {
				const match = line.match(/^- \[([ x~])\] (.+)$/);
				if (match) {
					let status: 'Pending' | 'In Progress' | 'Completed';
					if (match[1] === 'x') status = 'Completed';
					else if (match[1] === '~') status = 'In Progress';
					else status = 'Pending';
					const item = new SpecTreeItem(`${match[2]}`, 'Execution Status', i);
					item.contextValue = 'todoItem';
					item.description = status;
					item.iconPath = new vscode.ThemeIcon(
						status === 'Completed' ? 'check' : status === 'In Progress' ? 'sync' : 'circle-outline'
					);
					items.push(item);
				}
			}
		}
	}
	return items;
}

export function activate(context: vscode.ExtensionContext) {
	// Reparse spec.md after each save
	vscode.workspace.onDidSaveTextDocument((doc) => {
		const specPath = getSpecPath();
		if (specPath && doc.uri.fsPath === specPath) {
			// Providers for each section
			const todosProvider = new SpecProvider('TODOS');
			const requirementsProvider = new SpecProvider('Requirements *(mandatory)*');
			const implementationsProvider = new SpecProvider('Execution Status');
			vscode.window.registerTreeDataProvider('todosView', todosProvider);
			vscode.window.registerTreeDataProvider('requirementsView', requirementsProvider);
			vscode.window.registerTreeDataProvider('implementationsView', implementationsProvider);
			vscode.window.showInformationMessage('spec.md reparsed after save!');
		}
	});
		// Loop until spec.md is found, then parse and show toast
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
					vscode.window.showErrorMessage('spec.md not found in workspace. Please add spec.md to your project.');
					return;
				}
				// Providers for each section
				const todosProvider = new SpecProvider('Review & Acceptance Checklist');
				const requirementsProvider = new SpecProvider('Requirements *(mandatory)*');
				const implementationsProvider = new SpecProvider('Execution Status');

				vscode.window.registerTreeDataProvider('todosView', todosProvider);
				vscode.window.registerTreeDataProvider('requirementsView', requirementsProvider);
				vscode.window.registerTreeDataProvider('implementationsView', implementationsProvider);

				// Watch spec.md for changes using workspaceFolders
				let specFolder = undefined;
				const folders = vscode.workspace.workspaceFolders;
				if (folders && folders.length > 0) {
					specFolder = folders[0].uri.fsPath;
				}
				if (specFolder) {
					const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(specFolder, 'spec.md'));
					watcher.onDidChange(() => {
						todosProvider.refresh();
						requirementsProvider.refresh();
						implementationsProvider.refresh();
						vscode.window.showInformationMessage('spec.md re-parsed!');
					});
					watcher.onDidCreate(() => {
						todosProvider.refresh();
						requirementsProvider.refresh();
						implementationsProvider.refresh();
						vscode.window.showInformationMessage('spec.md re-parsed!');
					});
					watcher.onDidDelete(() => {
						todosProvider.refresh();
						requirementsProvider.refresh();
						implementationsProvider.refresh();
						vscode.window.showErrorMessage('spec.md deleted from workspace.');
					});
					context.subscriptions.push(watcher);
				}
			}
			waitForSpecAndParse();

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

		// ...existing code...
}

export function deactivate() {}
