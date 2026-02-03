# GitHub Actions GUI

A visual editor for GitHub Actions workflow files. Open a workflow (YAML), view jobs and steps as a diagram, edit job properties in a side panel, and save back to YAML.

![Visual Editor screenshot](/docs/images/visual-editor.png)

## Features

- **Diagram**: Jobs as nodes, edges from `needs` dependencies. Built with [React Flow](https://reactflow.dev/).
- **Property panel**: Click a job node to edit name, runs-on, needs, and steps (N8N-style).
- **Open**: Load from file (`.yml`/`.yaml`) or paste YAML.
- **Save**: Download the workflow as a YAML file.
- **Validation**: Parse errors shown in a banner when opening or pasting.

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
```

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
