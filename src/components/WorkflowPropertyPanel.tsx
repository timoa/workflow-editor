import { useCallback, useMemo } from 'react'
import type { Workflow } from '@/types/workflow'

interface WorkflowPropertyPanelProps {
  workflow: Workflow
  onWorkflowChange: (workflow: Workflow) => void
  onClose: () => void
}

export function WorkflowPropertyPanel({
  workflow,
  onWorkflowChange,
  onClose,
}: WorkflowPropertyPanelProps) {
  const updateWorkflow = useCallback(
    (updater: (w: Workflow) => Workflow) => {
      onWorkflowChange(updater(workflow))
    },
    [workflow, onWorkflowChange]
  )

  const setWorkflowField = useCallback(
    <K extends keyof Workflow>(key: K, value: Workflow[K]) => {
      updateWorkflow((w) => ({ ...w, [key]: value }))
    },
    [updateWorkflow]
  )

  const env = useMemo(() => workflow.env ?? {}, [workflow.env])

  const updateEnvVar = useCallback(
    (key: string, value: string) => {
      const newEnv = { ...env }
      if (value === '') {
        delete newEnv[key]
      } else {
        newEnv[key] = value
      }
      setWorkflowField('env', Object.keys(newEnv).length > 0 ? newEnv : undefined)
    },
    [env, setWorkflowField]
  )

  const removeEnvVar = useCallback(
    (key: string) => {
      const newEnv = { ...env }
      delete newEnv[key]
      setWorkflowField('env', Object.keys(newEnv).length > 0 ? newEnv : undefined)
    },
    [env, setWorkflowField]
  )

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col border-b border-slate-200 px-4 py-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Workflow config</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close panel"
        >
          <span className="text-lg leading-none">×</span>
        </button>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">Name, run name, and environment variables</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500">Workflow name</label>
          <input
            type="text"
            value={workflow.name ?? ''}
            onChange={(e) => setWorkflowField('name', e.target.value || undefined)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="Untitled Workflow"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Run name</label>
          <input
            type="text"
            value={workflow['run-name'] ?? ''}
            onChange={(e) => setWorkflowField('run-name', e.target.value || undefined)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="Run name expression"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-slate-500">Environment Variables</label>
            <button
              type="button"
              onClick={() => {
                const newEnv = { ...env, '': '' }
                setWorkflowField('env', newEnv)
              }}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              + Add variable
            </button>
          </div>
          {Object.keys(env).length === 0 ? (
            <p className="text-xs text-slate-500 italic">No environment variables configured</p>
          ) : (
            <div className="space-y-1.5">
              {Object.entries(env).map(([key, value]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => {
                      const newEnv = { ...env }
                      delete newEnv[key]
                      newEnv[e.target.value] = value
                      setWorkflowField('env', Object.keys(newEnv).length > 0 ? newEnv : undefined)
                    }}
                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                    placeholder="Variable name"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => updateEnvVar(key, e.target.value)}
                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                    placeholder="Value"
                  />
                  <button
                    type="button"
                    onClick={() => removeEnvVar(key)}
                    className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 shrink-0"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
