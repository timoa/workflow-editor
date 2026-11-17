import * as vscode from 'vscode';
import * as path from 'node:path';

export class WorkflowEditorProvider {
  public static readonly viewType = 'workflowEditor';

  /** All open workflow editor panels (one per tab). */
  private static _instances: Set<WorkflowEditorProvider> = new Set();
  /** The panel that currently has focus (for Save/Undo commands). */
  private static _activeInstance: WorkflowEditorProvider | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  /**
   * Create a new panel or reveal an existing one for the given file.
   * When fileToLoad is provided and a panel already exists for that URI, that panel is revealed.
   * Otherwise a new panel is created so the user does not lose unsaved changes in the current tab.
   */
  public static async createOrShow(extensionUri: vscode.Uri, fileToLoad?: vscode.Uri): Promise<WorkflowEditorProvider> {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (fileToLoad) {
      const existing = WorkflowEditorProvider._findByUri(fileToLoad);
      if (existing) {
        existing._panel.reveal(column);
        return existing;
      }
      const emptyPanel = WorkflowEditorProvider._findEmptyPanel();
      if (emptyPanel) {
        emptyPanel._panel.reveal(column);
        emptyPanel._pendingFile = fileToLoad;
        if (emptyPanel._isWebviewReady) {
          await emptyPanel.loadFile(fileToLoad);
        }
        return emptyPanel;
      }
    }

    const panel = vscode.window.createWebviewPanel(
      WorkflowEditorProvider.viewType,
      fileToLoad ? path.basename(fileToLoad.fsPath) : 'Workflow Editor',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'images'),
        ],
        retainContextWhenHidden: true,
      }
    );
    panel.iconPath = vscode.Uri.joinPath(extensionUri, 'images', 'icon.svg');

    const instance = new WorkflowEditorProvider(panel, extensionUri);
    if (fileToLoad) {
      instance._pendingFile = fileToLoad;
    }
    WorkflowEditorProvider._instances.add(instance);
    return instance;
  }

  private static _findByUri(uri: vscode.Uri): WorkflowEditorProvider | undefined {
    const key = uri.toString();
    for (const p of WorkflowEditorProvider._instances) {
      const current = p.getCurrentFileUri();
      if (current?.toString() === key) return p;
    }
    return undefined;
  }

  private static _findEmptyPanel(): WorkflowEditorProvider | undefined {
    if (WorkflowEditorProvider._instances.size !== 1) return undefined;
    const only = WorkflowEditorProvider._instances.values().next().value as WorkflowEditorProvider;
    return only.getCurrentFileUri() === undefined ? only : undefined;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Track active panel for Save/Undo and set context key for keybinding
    const updateFocusContext = () => {
      if (this._panel.active) {
        WorkflowEditorProvider._activeInstance = this;
      }
      vscode.commands.executeCommand('setContext', 'workflowEditorFocus', this._panel.active);

      // When panel becomes visible, reload current file only if it changed and (if webview is dirty) user confirms
      if (this._panel.visible && this._currentFileUri && this._isWebviewReady) {
        if (this._reloadOnFocusTimeout) {
          clearTimeout(this._reloadOnFocusTimeout);
        }
        this._reloadOnFocusTimeout = setTimeout(() => {
          this._reloadOnFocusTimeout = undefined;
          this._reloadIfChangedOnFocus();
        }, 150);
      }
    };
    updateFocusContext();
    this._panel.onDidChangeViewState(updateFocusContext, null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'openFile':
            await this._handleOpenFile();
            return;
          case 'saveFile':
            await this._handleSaveFile(message.content, message.filename);
            return;
          case 'getTheme':
            this._sendTheme();
            return;
          case 'ready':
            // Webview is ready
            this._isWebviewReady = true;
            // Send initial theme
            this._sendTheme();
            // If there's a file to load, load it
            if (this._pendingFile) {
              const uri = this._pendingFile;
              this._pendingFile = undefined;
              await this.loadFile(uri);
            }
            return;
          case 'dirtyState':
            // Response to requestDirtyState: reload only if user confirms when dirty
            this._handleDirtyStateResponse(message.isDirty === true);
            return;
        }
      },
      null,
      this._disposables
    );

    // Listen for theme changes
    vscode.window.onDidChangeActiveColorTheme(() => {
      this._sendTheme();
    }, null, this._disposables);
  }

  private _pendingFile: vscode.Uri | undefined;
  private _isWebviewReady: boolean = false;
  /** When set, Save writes directly to this file instead of showing Save As dialog. */
  private _currentFileUri: vscode.Uri | undefined;
  private _reloadOnFocusTimeout: ReturnType<typeof setTimeout> | undefined;
  /** Last content sent to webview (to avoid reload when file unchanged). */
  private _lastLoadedContent: string | undefined;
  /** Last known file mtime (to detect external changes). */
  private _lastLoadedMtime: number | undefined;

  public static getInstance(): WorkflowEditorProvider | undefined {
    return WorkflowEditorProvider._activeInstance;
  }

  public getCurrentFileUri(): vscode.Uri | undefined {
    return this._currentFileUri;
  }

  public requestSave(): void {
    this._panel.webview.postMessage({ command: 'saveRequest' });
  }

  public requestUndo(): void {
    this._panel.webview.postMessage({ command: 'undoRequest' });
  }

  public async loadFile(uri: vscode.Uri) {
    this._currentFileUri = uri;
    this._panel.title = path.basename(uri.fsPath);
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      const content = document.getText();
      const filename = path.basename(uri.fsPath);

      this._lastLoadedContent = content;
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        this._lastLoadedMtime = stat.mtime;
      } catch {
        this._lastLoadedMtime = undefined;
      }

      // If webview is ready, send immediately; otherwise store as pending
      if (this._isWebviewReady) {
        this._panel.webview.postMessage({
          command: 'loadFile',
          content,
          filename,
        });
      } else {
        // Store as pending - will be loaded when webview sends 'ready'
        this._pendingFile = uri;
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load file: ${error}`);
    }
  }

  /**
   * Called when panel becomes visible: only reload if file actually changed;
   * if webview has unsaved changes, prompt before discarding.
   */
  private async _reloadIfChangedOnFocus(): Promise<void> {
    const uri = this._currentFileUri;
    if (!uri) return;
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      const currentContent = document.getText();

      const contentUnchanged = this._lastLoadedContent !== undefined && currentContent === this._lastLoadedContent;
      let mtimeUnchanged = true;
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        mtimeUnchanged = this._lastLoadedMtime !== undefined && stat.mtime === this._lastLoadedMtime;
      } catch {
        // If stat fails, rely on content check only
      }
      if (contentUnchanged && mtimeUnchanged) {
        return;
      }

      this._panel.webview.postMessage({ command: 'requestDirtyState' });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to check file: ${error}`);
    }
  }

  private async _handleDirtyStateResponse(isDirty: boolean): Promise<void> {
    const uri = this._currentFileUri;
    if (!uri) return;
    if (isDirty) {
      const choice = await vscode.window.showWarningMessage(
        'File was modified elsewhere. Discard your unsaved changes and reload?',
        'Discard',
        'Cancel'
      );
      if (choice !== 'Discard') return;
    }
    await this.loadFile(uri);
  }

  private async _handleOpenFile() {
    const fileUri = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        'YAML Files': ['yml', 'yaml'],
      },
    });

    if (fileUri && fileUri[0]) {
      await this.loadFile(fileUri[0]);
    }
  }

  private async _handleSaveFile(content: string, suggestedFilename?: string) {
    const fileUri = this._currentFileUri ?? (await vscode.window.showSaveDialog({
      defaultUri: suggestedFilename
        ? vscode.Uri.joinPath(
            vscode.workspace.workspaceFolders?.[0]?.uri || vscode.Uri.file(''),
            suggestedFilename
          )
        : vscode.Uri.joinPath(
            vscode.workspace.workspaceFolders?.[0]?.uri || vscode.Uri.file(''),
            'workflow.yml'
          ),
      filters: {
        'YAML Files': ['yml', 'yaml'],
      },
    })) ?? undefined;

    if (fileUri) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        await vscode.workspace.fs.writeFile(fileUri, data);
        if (!this._currentFileUri) {
          this._currentFileUri = fileUri;
        }
        vscode.window.showInformationMessage(`Workflow saved to ${path.basename(fileUri.fsPath)}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to save file: ${error}`);
      }
    }
  }

  private _sendTheme() {
    const theme = vscode.window.activeColorTheme.kind;
    const themeName = theme === vscode.ColorThemeKind.Dark ? 'dark' :
                     theme === vscode.ColorThemeKind.Light ? 'light' :
                     'dark'; // Default to dark for high contrast

    this._panel.webview.postMessage({
      command: 'themeChanged',
      theme: themeName,
    });
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')
    );

    // Get the local path to css styles, then convert it to a uri we can use in the webview.
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css')
    );

    // Use a nonce to only allow a specific script to be run.
    const nonce = getNonce();

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleUri}" rel="stylesheet">
				<title>Workflow Editor</title>
			</head>
			<body>
				<div id="root"></div>
				<script nonce="${nonce}">
					try {
						const vscode = acquireVsCodeApi();
						window.vscode = vscode;
					} catch (error) {
						console.error('Failed to acquire VSCode API:', error);
					}
				</script>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }

  public dispose() {
    if (this._reloadOnFocusTimeout) {
      clearTimeout(this._reloadOnFocusTimeout);
      this._reloadOnFocusTimeout = undefined;
    }
    WorkflowEditorProvider._instances.delete(this);
    if (WorkflowEditorProvider._activeInstance === this) {
      WorkflowEditorProvider._activeInstance = undefined;
      vscode.commands.executeCommand('setContext', 'workflowEditorFocus', false);
    }

    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
