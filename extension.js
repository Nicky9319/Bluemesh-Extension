// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * Navigation Data Provider for VS Code Tree View
 */
class NavigationDataProvider {
	constructor() {
		this._onDidChangeTreeData = new vscode.EventEmitter();
		this.onDidChangeTreeData = this._onDidChangeTreeData.event;
	}

	refresh() {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element) {
		return element;
	}

	getChildren(element) {
		if (!element) {
			// Return the three main navigation items
			return Promise.resolve([
				new NavigationItem('Home', 'home', vscode.TreeItemCollapsibleState.None, 'home-outline'),
				new NavigationItem('Console', 'console', vscode.TreeItemCollapsibleState.None, 'terminal'),
				new NavigationItem('Architecture View', 'architecture', vscode.TreeItemCollapsibleState.None, 'graph-line')
			]);
		}
		return Promise.resolve([]);
	}
}

/**
 * Navigation Item for Tree View
 */
class NavigationItem extends vscode.TreeItem {
	constructor(label, contextValue, collapsibleState, iconName) {
		super(label, collapsibleState);
		this.contextValue = contextValue;
		this.tooltip = label;
		this.iconPath = new vscode.ThemeIcon(iconName);
		
		// Set the command to execute when clicked
		this.command = {
			command: getCommandName(contextValue),
			title: `Open ${label}`,
			arguments: [this]
		};
	}
}

/**
 * Helper function to get the correct command name
 */
function getCommandName(contextValue) {
	switch (contextValue) {
		case 'home':
			return 'bluemesh.openHome';
		case 'console':
			return 'bluemesh.openConsole';
		case 'architecture':
			return 'bluemesh.openArchitectureView';
		default:
			return 'bluemesh.openHome';
	}
}

/**
 * Function to open a navigation tab and display its content
 */
function openNavigationTab(tabName) {
	// Create and show the webview panel for the selected tab
	const panel = vscode.window.createWebviewPanel(
		`bluemesh${tabName.replace(/\s/g, '')}`, // Identifies the type of the webview
		`Bluemesh - ${tabName}`, // Title of the panel displayed to the user
		vscode.ViewColumn.One, // Editor column to show the new webview panel in
		{
			enableScripts: true // Enable JavaScript in the webview
		}
	);

	// Set the HTML content for the webview based on the tab
	panel.webview.html = getNavigationTabContent(tabName);
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

	// Create the navigation data provider
	const navigationProvider = new NavigationDataProvider();
	
	// Register the tree view
	const treeView = vscode.window.createTreeView('bluemesh.navigationView', {
		treeDataProvider: navigationProvider,
		showCollapseAll: false
	});

	// Register commands
	const bluemeshDisposable = vscode.commands.registerCommand('bluemesh.activate', function () {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user and show the widget
		vscode.window.showInformationMessage('Bluemesh Extension is now active!');
		
		// Automatically show the widget when the extension is activated
		vscode.commands.executeCommand('bluemesh.showWidget');
	});

	// Navigation commands
	const homeDisposable = vscode.commands.registerCommand('bluemesh.openHome', () => {
		openNavigationTab('Home');
	});

	const consoleDisposable = vscode.commands.registerCommand('bluemesh.openConsole', () => {
		openNavigationTab('Console');
	});

	const architectureDisposable = vscode.commands.registerCommand('bluemesh.openArchitectureView', () => {
		openNavigationTab('Architecture View');
	});

	// Create a command to show the widget in the main editor area
	const showWidgetDisposable = vscode.commands.registerCommand('bluemesh.showWidget', () => {
		// Check for services.json in the workspace root
		if (!workspaceRoot) {
			vscode.window.showErrorMessage('No workspace folder open. Bluemesh extension cannot work.');
			return;
		}
		const servicesPath = path.join(workspaceRoot, 'services.json');
		if (!fs.existsSync(servicesPath)) {
			vscode.window.showErrorMessage('Bluemesh extension cannot work: services.json not found in the root directory.');
			return;
		}

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

	// Add disposables to subscriptions
	context.subscriptions.push(bluemeshDisposable);
	context.subscriptions.push(homeDisposable);
	context.subscriptions.push(consoleDisposable);
	context.subscriptions.push(architectureDisposable);
	context.subscriptions.push(showWidgetDisposable);
	context.subscriptions.push(treeView);

	// Show a welcome message
	vscode.window.showInformationMessage('Bluemesh Explorer is ready! Check the left panel.');
}

/**
 * Generate HTML content for navigation tabs
 */
function getNavigationTabContent(tabName) {
	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bluemesh - ${tabName}</title>
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
        .tab-header {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .tab-title {
            font-size: 2.5em;
            font-weight: bold;
            color: var(--vscode-titleBar-activeForeground);
            margin: 0;
        }
        .tab-subtitle {
            font-size: 1.2em;
            color: var(--vscode-descriptionForeground);
            margin-top: 10px;
        }
        .content-area {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 40px;
            border-radius: 10px;
            min-height: 300px;
        }
        .placeholder-text {
            font-size: 1.1em;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="tab-header">
            <h1 class="tab-title">📍 ${tabName}</h1>
            <p class="tab-subtitle">You have successfully opened the ${tabName} tab</p>
        </div>
        
        <div class="content-area">
            <p class="placeholder-text">
                This is the ${tabName} view. Content for this tab will be implemented here.
            </p>
        </div>
    </div>
</body>
</html>`;
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
