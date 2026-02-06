# Workflow Editor

A VSCode extension providing a visual editor for GitHub Actions workflow files. Open a workflow (YAML), view jobs and steps as a diagram, edit job properties in a side panel, and save back to YAML.

![Workflow Editor screenshot](https://workflow-editor.com/images/visual-editor-hero.webp)

## Features

- **Diagram**: Jobs as nodes, edges from `needs` dependencies. Built with [React Flow](https://reactflow.dev/).
- **Trigger visualization**: Visual trigger nodes showing workflow triggers (push, pull_request, schedule, etc.) with connections to jobs.
- **Trigger editing**: Edit workflow triggers with a dedicated panel supporting all trigger types and configurations (branches, tags, paths, cron schedules, etc.).
- **Property panel**: Click a job node to edit name, runs-on, needs, matrix strategy, and steps (N8N-style).
- **Matrix strategy**: Configure matrix builds with multiple variable combinations. Visual indicator shows total matrix combinations (e.g., "6× matrix").
- **Source code preview**: View and edit workflow YAML in a large dialog. Changes apply only when saved.
- **Workflow linting**: Automatic validation of workflow syntax, trigger names, job dependencies, and circular dependencies with detailed error messages.
- **VSCode Integration**: Open files via VSCode file dialogs, save directly to workspace. Theme automatically matches your IDE theme.
- **Validation**: Parse errors and lint errors shown in a banner when opening, pasting, or editing workflows.

## Installation

### From Marketplace

1. Open VSCode (or Cursor, Windsurf, or other VSCode-based IDE)
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "Workflow Editor"
4. Click Install

### From VSIX

1. Download the `.vsix` file from [Releases](https://github.com/timoa/workflow-editor/releases)
2. Open VSCode
3. Go to Extensions → ... → Install from VSIX...
4. Select the downloaded `.vsix` file

## Usage

### Open Workflow Editor

- **Command Palette**: Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac), type "Workflow Editor: Open", and press Enter
- **Context Menu**: Right-click a `.yml` or `.yaml` file in the Explorer, select "Open with Workflow Editor"
- **Command**: `workflow-visual-editor.open` - Opens an empty editor
- **Command**: `workflow-visual-editor.openFile` - Opens file picker to load a workflow

### Keyboard Shortcuts

- **Ctrl/Cmd+O**: Open file (in webview)
- **Ctrl/Cmd+S**: Save workflow (in webview)
- **Escape**: Close property panel or paste dialog

### File Operations

- **Open**: Click the folder icon or use Ctrl/Cmd+O to open a workflow file
- **Paste YAML**: Click the clipboard icon to paste YAML content
- **Save**: Click the save icon or use Ctrl/Cmd+S to save the workflow
- **View Source**: Click the code icon to view/edit raw YAML

## Development

### Prerequisites

- Node.js >= 24
- PNPM >= 10
- VSCode (for testing the extension)

### Setup

```bash
pnpm install
```

### Build

```bash
# Build extension code
pnpm run compile

# Build webview bundle
pnpm run webpack

# Or build both (for packaging)
pnpm run vscode:prepublish
```

### Development Mode

```bash
# Watch extension code
pnpm run watch

# Watch webview bundle (in another terminal)
pnpm run webpack-dev
```

### Debug

1. Open this project in VSCode
2. Press `F5` to launch Extension Development Host
3. In the Extension Development Host, use the commands to open the workflow editor
4. Set breakpoints in `src/extension/` or `src/webview/` code

### Package Extension

```bash
# Create .vsix file
pnpm run package
```

The `.vsix` file will be created in the project root.

### Test

```bash
pnpm test
pnpm lint
```

## CI (Pull request checks)

On every pull request to `main` or `master`, GitHub Actions runs:

- **Lint**: ESLint (TypeScript + React hooks and refresh)
- **Test**: Vitest
- **Build**: TypeScript compilation and webpack bundle
- **Security**: `pnpm audit --audit-level=high` (fails on high or critical vulnerabilities)

Workflow file: [.github/workflows/pull-request.yml](.github/workflows/pull-request.yml). Runs only when relevant files (e.g. `src/`, configs, `package.json`, lockfile) change.

## Release & Publishing

### Automated Release

Releases are automated with [Semantic Release](https://semantic-release.gitbook.io/). On every **push to `main` or `master`**:

1. **Test** job runs: lint, unit tests (Vitest), and build.
2. **Release** job runs only if tests pass: Semantic Release analyzes commits, bumps the version, updates `package.json` and `CHANGELOG.md`, pushes a release commit, and creates a GitHub release.

Use [Conventional Commits](https://www.conventionalcommits.org/) so versions and changelog are derived from commit messages:

- `feat: ...` → minor release (e.g. 1.1.0)
- `fix: ...` → patch (e.g. 1.0.1)
- `feat!: ...` or `fix!: ...` → major (e.g. 2.0.0)
- `docs:`, `chore:`, etc. → no release (included in changelog when relevant)

Workflow: [.github/workflows/release.yml](.github/workflows/release.yml). Config: [.releaserc.cjs](.releaserc.cjs).

### Publishing to Marketplace

When a GitHub release is created, the [publish workflow](.github/workflows/publish.yml) automatically:

1. Builds the extension (`pnpm run compile` + `pnpm run webpack`)
2. Packages it (`pnpm run package`)
3. Publishes to VSCode Marketplace (`pnpm run publish`)

**Required Secret**: `VSCE_PAT` - Personal Access Token from [Azure DevOps](https://dev.azure.com/) with Marketplace publish permissions.

To get a token:
1. Go to https://dev.azure.com/
2. Create or sign in to your organization
3. Go to User Settings → Personal Access Tokens
4. Create a token with "Marketplace (Manage)" scope
5. Add it as `VSCE_PAT` secret in GitHub repository settings

## Keyboard shortcuts

- **Ctrl/Cmd+O**: Open file
- **Ctrl/Cmd+S**: Save workflow
- **Escape**: Close property panel or paste dialog

## Stack

- **Extension Host**: Node.js + VSCode Extension API
- **Webview UI**: React 18 + TypeScript
- **Build**: TypeScript compiler + Webpack
- **Flow Editor**: [@xyflow/react](https://www.npmjs.com/package/@xyflow/react) (React Flow)
- **YAML**: [yaml](https://www.npmjs.com/package/yaml) for parse/serialize
- **Styling**: Tailwind CSS
- **Packaging**: [@vscode/vsce](https://www.npmjs.com/package/@vscode/vsce)

## Compatibility

- **VSCode**: Full support (minimum version 1.80.0)
- **Cursor**: Compatible (VSCode-compatible extension)
- **Windsurf**: Compatible (VSCode-compatible extension)
- **Other VSCode-based IDEs**: Should work with any IDE that supports VSCode extensions
