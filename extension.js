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
		// Display a message box to the user and show the widget
		vscode.window.showInformationMessage('Bluemesh Extension is now active!');
		
		// Automatically show the widget when the extension is activated
		vscode.commands.executeCommand('bluemesh.showWidget');
	});

	const refreshDisposable = vscode.commands.registerCommand('bluemesh.refreshDirectory', () => {
		directoryProvider.refresh();
		vscode.window.showInformationMessage('Directory refreshed!');
	});

	// Create a command to show the widget in the main editor area
	const showWidgetDisposable = vscode.commands.registerCommand('bluemesh.showWidget', () => {
		// Create and show the webview panel
		const panel = vscode.window.createWebviewPanel(
			'bluemeshWidget', // Identifies the type of the webview
			'Bluemesh Widget', // Title of the panel displayed to the user
			vscode.ViewColumn.One, // Editor column to show the new webview panel in
			{
				enableScripts: true // Enable JavaScript in the webview
			}
		);

		// Set the HTML content for the webview
		panel.webview.html = getWebviewContent();

		// Handle messages from the webview
		panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'showHelloWorld':
						// Display Hello World message
						vscode.window.showInformationMessage('Hello World from Bluemesh Widget!');
						
						// Also update the webview content to show Hello World
						panel.webview.postMessage({ command: 'displayHelloWorld' });
						break;
					case 'alert':
						vscode.window.showInformationMessage(message.text);
						break;
				}
			},
			undefined,
			context.subscriptions
		);
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
	context.subscriptions.push(showWidgetDisposable);
	context.subscriptions.push(workspaceChangeDisposable);
	context.subscriptions.push(treeView);

	// Show a welcome message
	vscode.window.showInformationMessage('Bluemesh Explorer is ready! Check the left panel.');
}

/**
 * Generate HTML content for the webview widget
 */
function getWebviewContent() {
	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bluemesh Widget</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            text-align: center;
        }
        .widget-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 15px 30px;
            font-size: 16px;
            border-radius: 5px;
            cursor: pointer;
            margin: 10px;
            transition: background-color 0.2s;
        }
        .widget-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .output {
            margin-top: 30px;
            padding: 20px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px;
            min-height: 100px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
        }
        .hidden {
            display: none;
        }
        h1 {
            color: var(--vscode-titleBar-activeForeground);
            margin-bottom: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Bluemesh Control Widget</h1>
        <p>Click the button below to test our control over the VS Code interface:</p>
        
        <button class="widget-button" onclick="showHelloWorld()">
            Click Me - Show Hello World!
        </button>
        
        <button class="widget-button" onclick="showAlert()">
            Show Custom Alert
        </button>
        
        <div id="output" class="output hidden">
            <!-- Hello World will appear here -->
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function showHelloWorld() {
            // Send message to extension
            vscode.postMessage({
                command: 'showHelloWorld'
            });
        }
        
        function showAlert() {
            vscode.postMessage({
                command: 'alert',
                text: 'This is a custom alert from the Bluemesh Widget!'
            });
        }
        
        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'displayHelloWorld':
                    const output = document.getElementById('output');
                    output.innerHTML = '🎉 Hello World from Bluemesh! 🎉';
                    output.classList.remove('hidden');
                    break;
            }
        });
    </script>
</body>
</html>`;
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
