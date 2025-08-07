// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * Directory Tree Data Provider for VS Code Tree View
 */
class DirectoryTreeDataProvider {
	constructor(workspaceRoot) {
		this.workspaceRoot = workspaceRoot;
		this._onDidChangeTreeData = new vscode.EventEmitter();
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
	}

	refresh() {
		this._onDidChangeTreeData.fire();
	}
5
	getTreeItem(element) {
		return element;
	}

	getChildren(element) {
		if (!this.workspaceRoot) {
			vscode.window.showInformationMessage('No workspace folder open');
			return Promise.resolve([]);
		}

		if (element) {
			// If element is provided, show its children
			return Promise.resolve(this.getDirectoryContents(element.resourceUri.fsPath));
		} else {
			// If no element, show root directory contents
			return Promise.resolve(this.getDirectoryContents(this.workspaceRoot));
		}
	}

	getDirectoryContents(dirPath) {
		if (this.pathExists(dirPath)) {
			try {
				return fs.readdirSync(dirPath).map(item => {
					const itemPath = path.join(dirPath, item);
					try {
						const stat = fs.statSync(itemPath);
						
						return new DirectoryItem(
							item,
							vscode.Uri.file(itemPath),
							stat.isDirectory() ? 
								vscode.TreeItemCollapsibleState.Collapsed : 
								vscode.TreeItemCollapsibleState.None,
							stat.isDirectory() ? 'folder' : 'file',
							stat
						);
					} catch (statError) {
						// If we can't stat the file, show it as a file with unknown status
						return new DirectoryItem(
							`${item} (access denied)`,
							vscode.Uri.file(itemPath),
							vscode.TreeItemCollapsibleState.None,
							'file',
							{ size: 0, mtime: new Date(), isDirectory: () => false }
						);
					}
				}).filter(item => item !== null);
			} catch (readError) {
				vscode.window.showErrorMessage(`Failed to read directory: ${dirPath}`);
				return [];
			}
		} else {
			return [];
		}
	}

	pathExists(p) {
		try {
			fs.accessSync(p);
		} catch (err) {
			return false;
		}
		return true;
	}
}

/**
 * Directory Item for Tree View
 */
class DirectoryItem extends vscode.TreeItem {
	constructor(label, resourceUri, collapsibleState, contextValue, stats) {
		super(label, collapsibleState);
		this.resourceUri = resourceUri;
		this.contextValue = contextValue;
		this.tooltip = this.getTooltip(stats);
		this.description = this.getDescription(stats);
		
		if (contextValue === 'file') {
			this.command = {
				command: 'vscode.open',
				title: 'Open File',
				arguments: [resourceUri]
			};
		}
		
		// Set appropriate icons
		if (contextValue === 'folder') {
			this.iconPath = new vscode.ThemeIcon('folder');
		} else {
			this.iconPath = new vscode.ThemeIcon('file');
		}
	}

	getTooltip(stats) {
		const size = stats.isDirectory() ? 'Directory' : `${stats.size} bytes`;
		const modified = stats.mtime.toLocaleDateString();
		return `${this.label}\nSize: ${size}\nModified: ${modified}`;
	}

	getDescription(stats) {
		if (stats.isDirectory()) {
			return '';
		}
		// Show file size for files
		if (stats.size < 1024) {
			return `${stats.size} B`;
		} else if (stats.size < 1024 * 1024) {
			return `${(stats.size / 1024).toFixed(1)} KB`;
		} else {
			return `${(stats.size / (1024 * 1024)).toFixed(1)} MB`;
		}
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "bluemesh" is now active!');

	// Get the current workspace root
	const workspaceRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
		? vscode.workspace.workspaceFolders[0].uri.fsPath
		: undefined;

	// Create the directory tree data provider
	const directoryProvider = new DirectoryTreeDataProvider(workspaceRoot);
	
	// Register the tree view
	const treeView = vscode.window.createTreeView('bluemesh.directoryView', {
		treeDataProvider: directoryProvider,
		showCollapseAll: true
	});

	// Register commands
	const bluemeshDisposable = vscode.commands.registerCommand('bluemesh.activate', function () {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Bluemesh Extension is now active!');
	});

	const refreshDisposable = vscode.commands.registerCommand('bluemesh.refreshDirectory', () => {
		directoryProvider.refresh();
		vscode.window.showInformationMessage('Directory refreshed!');
	});

	// Listen for workspace folder changes
	const workspaceChangeDisposable = vscode.workspace.onDidChangeWorkspaceFolders(() => {
		const newWorkspaceRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
			? vscode.workspace.workspaceFolders[0].uri.fsPath
			: undefined;
		
		directoryProvider.workspaceRoot = newWorkspaceRoot;
		directoryProvider.refresh();
	});

	// Add disposables to subscriptions
	context.subscriptions.push(bluemeshDisposable);
	context.subscriptions.push(refreshDisposable);
	context.subscriptions.push(workspaceChangeDisposable);
	context.subscriptions.push(treeView);

	// Show a welcome message
	vscode.window.showInformationMessage('Bluemesh Explorer is ready! Check the left panel.');
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
