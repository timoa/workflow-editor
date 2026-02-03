# GitHub Actions GUI

A visual editor for GitHub Actions workflow files. Open a workflow (YAML), view jobs and steps as a diagram, edit job properties in a side panel, and save back to YAML.

![Visual Editor screenshot](/docs/images/visual-editor.png)

## Features

- **Diagram**: Jobs as nodes, edges from `needs` dependencies. Built with [React Flow](https://reactflow.dev/).
- **Trigger visualization**: Visual trigger nodes showing workflow triggers (push, pull_request, schedule, etc.) with connections to jobs.
- **Trigger editing**: Edit workflow triggers with a dedicated panel supporting all trigger types and configurations (branches, tags, paths, cron schedules, etc.).
- **Property panel**: Click a job node to edit name, runs-on, needs, matrix strategy, and steps (N8N-style).
- **Matrix strategy**: Configure matrix builds with multiple variable combinations. Visual indicator shows total matrix combinations (e.g., "6× matrix").
- **Source code preview**: View and edit workflow YAML in a large dialog. Changes apply only when saved.
- **Workflow linting**: Automatic validation of workflow syntax, trigger names, job dependencies, and circular dependencies with detailed error messages.
- **Open**: Load from file (`.yml`/`.yaml`) or paste YAML.
- **Save**: Download the workflow as a YAML file.
- **Validation**: Parse errors and lint errors shown in a banner when opening, pasting, or editing workflows.

## Run

```bash
pnpm install
pnpm dev
```

Then open http://localhost:5173.

## Build & test

```bash
pnpm build
pnpm test
pnpm lint
```

## CI (Pull request checks)

On every pull request to `main` or `master`, GitHub Actions runs:

- **Lint**: ESLint (TypeScript + React hooks and refresh)
- **Test**: Vitest
- **Build**: TypeScript (`tsc -b`) and Vite build
- **Security**: `pnpm audit --audit-level=high` (fails on high or critical vulnerabilities)

Workflow file: [.github/workflows/pull-request.yml](.github/workflows/pull-request.yml). Runs only when relevant files (e.g. `src/`, configs, `package.json`, lockfile) change.

## Keyboard shortcuts

- **Ctrl/Cmd+O**: Open file
- **Ctrl/Cmd+S**: Save workflow
- **Escape**: Close property panel or paste dialog

## Stack

- React 18 + TypeScript
- Vite
- [@xyflow/react](https://www.npmjs.com/package/@xyflow/react) (React Flow)
- [yaml](https://www.npmjs.com/package/yaml) for parse/serialize
- Tailwind CSS
