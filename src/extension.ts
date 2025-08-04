import * as vscode from 'vscode';

type TodoStatus = 'Pending' | 'In Progress' | 'Completed';

class TodoItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public status: TodoStatus,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
	) {
		super(label, collapsibleState);
		this.contextValue = 'todoItem';
		this.description = `(${status})`;
		this.iconPath = new vscode.ThemeIcon(
			status === 'Completed' ? 'check' : status === 'In Progress' ? 'sync' : 'circle-outline'
		);
	}
}

class TodosProvider implements vscode.TreeDataProvider<TodoItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<TodoItem | undefined | void> = new vscode.EventEmitter<TodoItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<TodoItem | undefined | void> = this._onDidChangeTreeData.event;

	private todos: TodoItem[] = [
		new TodoItem('Sample TODO 1', 'Pending'),
		new TodoItem('Sample TODO 2', 'In Progress'),
		new TodoItem('Sample TODO 3', 'Completed')
	];

	getTreeItem(element: TodoItem): vscode.TreeItem {
		return element;
	}
	getChildren(): Thenable<TodoItem[]> {
		return Promise.resolve(this.todos);
	}

	updateStatus(item: TodoItem, status: TodoStatus) {
		item.status = status;
		item.description = `(${status})`;
		item.iconPath = new vscode.ThemeIcon(
			status === 'Completed' ? 'check' : status === 'In Progress' ? 'sync' : 'circle-outline'
		);
		this._onDidChangeTreeData.fire();
	}

	addTodo(label: string) {
		this.todos.push(new TodoItem(label, 'Pending'));
		this._onDidChangeTreeData.fire();
	}
}

class SimpleProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;
	constructor(private items: vscode.TreeItem[]) {}
	getTreeItem(element: vscode.TreeItem): vscode.TreeItem { return element; }
	getChildren(): Thenable<vscode.TreeItem[]> { return Promise.resolve(this.items); }
}

export function activate(context: vscode.ExtensionContext) {
	// TODOS
	const todosProvider = new TodosProvider();
	vscode.window.registerTreeDataProvider('todosView', todosProvider);

	context.subscriptions.push(
		vscode.commands.registerCommand('sdd-vscode-ext.updateTodoStatus', async (item: TodoItem) => {
			const status = await vscode.window.showQuickPick(['Pending', 'In Progress', 'Completed'], {
				placeHolder: 'Select new status'
			});
			if (status) {
				todosProvider.updateStatus(item, status as TodoStatus);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('sdd-vscode-ext.addTodo', async () => {
			const label = await vscode.window.showInputBox({ prompt: 'Enter TODO label' });
			if (label) {
				todosProvider.addTodo(label);
			}
		})
	);

	// REQUIREMENTS
	const requirementsProvider = new SimpleProvider([
		new vscode.TreeItem('Functional (1)', vscode.TreeItemCollapsibleState.None),
		new vscode.TreeItem('Non-Functional (0)', vscode.TreeItemCollapsibleState.None),
		new vscode.TreeItem('Technical (0)', vscode.TreeItemCollapsibleState.None)
	]);
	vscode.window.registerTreeDataProvider('requirementsView', requirementsProvider);

	// IMPLEMENTATIONS
	const implementationsProvider = new SimpleProvider([
		new vscode.TreeItem('Functions (2)', vscode.TreeItemCollapsibleState.None),
		new vscode.TreeItem('Classes (0)', vscode.TreeItemCollapsibleState.None),
		new vscode.TreeItem('Components (0)', vscode.TreeItemCollapsibleState.None),
		new vscode.TreeItem('Modules (0)', vscode.TreeItemCollapsibleState.None),
		new vscode.TreeItem('Tests (0)', vscode.TreeItemCollapsibleState.None)
	]);
	vscode.window.registerTreeDataProvider('implementationsView', implementationsProvider);
}

export function deactivate() {}
