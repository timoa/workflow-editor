import { useEffect, useRef, useState } from 'react'

interface PasteYamlDialogProps {
  onClose: () => void
  onLoad: (yaml: string) => void
}

export function PasteYamlDialog({ onClose, onLoad }: PasteYamlDialogProps) {
  const [yaml, setYaml] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleLoad = () => {
    onLoad(yaml)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paste-dialog-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="paste-dialog-title" className="text-lg font-semibold text-slate-800">
          Paste YAML
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Paste your GitHub Actions workflow YAML below, then click Load.
        </p>
        <textarea
          ref={textareaRef}
          value={yaml}
          onChange={(e) => setYaml(e.target.value)}
          className="mt-3 w-full rounded border border-slate-300 p-3 font-mono text-sm"
          rows={16}
          placeholder={`name: My Workflow
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hello`}
          aria-label="Workflow YAML content"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLoad}
            className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
          >
            Load
          </button>
        </div>
      </div>
    </div>
  )
}
