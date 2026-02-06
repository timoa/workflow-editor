import * as vscode from 'vscode';
import { WorkflowEditorProvider } from './webview';

export function activate(context: vscode.ExtensionContext) {
  // Register command to open workflow editor
  const openCommand = vscode.commands.registerCommand('workflow-visual-editor.open', () => {
    WorkflowEditorProvider.createOrShow(context.extensionUri);
  });

  // Register command to open file picker and load workflow
  const openFileCommand = vscode.commands.registerCommand('workflow-visual-editor.openFile', async () => {
    const fileUri = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        'YAML Files': ['yml', 'yaml'],
      },
    });

    if (fileUri && fileUri[0]) {
      const provider = WorkflowEditorProvider.createOrShow(context.extensionUri);
      await provider.loadFile(fileUri[0]);
    }
  });

  // Register context menu command for .yml/.yaml files
  const openWithEditorCommand = vscode.commands.registerCommand(
    'workflow-visual-editor.openWithEditor',
    async (uri: vscode.Uri) => {
      // Create or show provider with file to load - will be loaded when webview is ready
      WorkflowEditorProvider.createOrShow(context.extensionUri, uri);
    }
  );

  context.subscriptions.push(openCommand, openFileCommand, openWithEditorCommand);

  // If a .yml/.yaml file is already open, offer to open it in the editor
  if (vscode.window.activeTextEditor) {
    const document = vscode.window.activeTextEditor.document;
    if (document.languageId === 'yaml' || document.fileName.endsWith('.yml') || document.fileName.endsWith('.yaml')) {
      // Optionally auto-open or show notification
    }
  }
}

export function deactivate() {}
