import { useCallback } from 'react'
import type { Workflow, WorkflowJob, WorkflowStep } from '@/types/workflow'

interface JobPropertyPanelProps {
  workflow: Workflow
  jobId: string
  onWorkflowChange: (workflow: Workflow) => void
  onClose: () => void
}

export function JobPropertyPanel({
  workflow,
  jobId,
  onWorkflowChange,
  onClose,
}: JobPropertyPanelProps) {
  const job = workflow.jobs[jobId]
  if (!job) return null

  const updateJob = useCallback(
    (updater: (j: WorkflowJob) => WorkflowJob) => {
      const next = { ...workflow, jobs: { ...workflow.jobs } }
      next.jobs[jobId] = updater(next.jobs[jobId])
      onWorkflowChange(next)
    },
    [workflow, jobId, onWorkflowChange]
  )

  const setJobField = useCallback(
    <K extends keyof WorkflowJob>(key: K, value: WorkflowJob[K]) => {
      updateJob((j) => ({ ...j, [key]: value }))
    },
    [updateJob]
  )

  const addStep = useCallback(() => {
    updateJob((j) => ({
      ...j,
      steps: [...(j.steps ?? []), { run: '' }],
    }))
  }, [updateJob])

  const updateStep = useCallback(
    (index: number, updater: (s: WorkflowStep) => WorkflowStep) => {
      updateJob((j) => {
        const steps = [...(j.steps ?? [])]
        steps[index] = updater(steps[index] ?? { run: '' })
        return { ...j, steps }
      })
    },
    [updateJob]
  )

  const removeStep = useCallback(
    (index: number) => {
      updateJob((j) => {
        const steps = (j.steps ?? []).filter((_, i) => i !== index)
        return { ...j, steps }
      })
    },
    [updateJob]
  )

  const runsOn = Array.isArray(job['runs-on']) ? job['runs-on'].join(', ') : String(job['runs-on'] ?? '')
  const needs = job.needs
    ? Array.isArray(job.needs)
      ? job.needs
      : [job.needs]
    : []

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <h2 className="text-sm font-semibold text-slate-800">Job: {jobId}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close panel"
        >
          <span className="text-lg leading-none">×</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500">Display name</label>
          <input
            type="text"
            value={job.name ?? ''}
            onChange={(e) => setJobField('name', e.target.value || undefined)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            placeholder={jobId}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Runs on</label>
          <input
            type="text"
            value={runsOn}
            onChange={(e) => setJobField('runs-on', e.target.value.trim() || 'ubuntu-latest')}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="ubuntu-latest"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Needs (job ids, comma-separated)</label>
          <input
            type="text"
            value={needs.join(', ')}
            onChange={(e) => {
              const list = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
              setJobField('needs', list.length === 0 ? undefined : list.length === 1 ? list[0] : list)
            }}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="build, test"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-slate-500">Steps</label>
            <button
              type="button"
              onClick={addStep}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              Add step
            </button>
          </div>
          <ul className="mt-2 space-y-3">
            {(job.steps ?? []).map((step, index) => (
              <li key={index} className="rounded border border-slate-200 bg-slate-50 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">Step {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                    aria-label={`Remove step ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={step.name ?? ''}
                    onChange={(e) => updateStep(index, (s) => ({ ...s, name: e.target.value || undefined }))}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    placeholder="Step name"
                  />
                  <input
                    type="text"
                    value={step.uses ?? ''}
                    onChange={(e) => updateStep(index, (s) => ({ ...s, uses: e.target.value || undefined }))}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    placeholder="uses: actions/checkout@v4"
                  />
                  <textarea
                    value={step.run ?? ''}
                    onChange={(e) => updateStep(index, (s) => ({ ...s, run: e.target.value || undefined }))}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm font-mono"
                    placeholder="run: ..."
                    rows={2}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  )
}
