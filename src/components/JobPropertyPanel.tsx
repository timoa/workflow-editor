import { useCallback, useState, useRef, useEffect } from 'react'
import type { Workflow, WorkflowJob, WorkflowStep } from '@/types/workflow'
import { SiUbuntu, SiApple } from 'react-icons/si'
import { FaWindows } from 'react-icons/fa'
import { HiServer } from 'react-icons/hi'

// Icon components for different platforms
// Ubuntu logo (circle of friends) – orange roundel, three white figures
function getLinuxIcon() {
  return <SiUbuntu className="text-[#E95420]" size={16} />
}

function getMacIcon() {
  return <SiApple className="text-gray-700" size={16} />
}

function getWindowsIcon() {
  return <FaWindows className="text-blue-500" size={16} />
}

function getServerIcon() {
  return <HiServer className="text-slate-600" size={16} />
}

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

  const otherJobIds = Object.keys(workflow.jobs).filter((id) => id !== jobId)

  // GitHub Actions runner options with icons
  const runnerOptions = [
    { value: 'ubuntu-latest', label: 'Ubuntu Latest', icon: getLinuxIcon() },
    { value: 'ubuntu-22.04', label: 'Ubuntu 22.04', icon: getLinuxIcon() },
    { value: 'ubuntu-20.04', label: 'Ubuntu 20.04', icon: getLinuxIcon() },
    { value: 'macos-latest', label: 'macOS Latest', icon: getMacIcon() },
    { value: 'macos-14', label: 'macOS 14', icon: getMacIcon() },
    { value: 'macos-13', label: 'macOS 13', icon: getMacIcon() },
    { value: 'macos-12', label: 'macOS 12', icon: getMacIcon() },
    { value: 'windows-latest', label: 'Windows Latest', icon: getWindowsIcon() },
    { value: 'windows-2022', label: 'Windows 2022', icon: getWindowsIcon() },
    { value: 'windows-2019', label: 'Windows 2019', icon: getWindowsIcon() },
    { value: 'self-hosted', label: 'Self-hosted', icon: getServerIcon() },
  ]

  const selectedOption = runnerOptions.find((opt) => opt.value === runsOn) || {
    value: runsOn,
    label: runsOn || 'ubuntu-latest',
    icon: getLinuxIcon(),
  }

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  const handleRunsOnChange = useCallback(
    (value: string) => {
      setJobField('runs-on', value || 'ubuntu-latest')
      setIsDropdownOpen(false)
    },
    [setJobField]
  )

  const toggleNeed = useCallback(
    (needId: string, checked: boolean, e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation()
      const current = needs as string[]
      const next = checked
        ? [...current, needId]
        : current.filter((id) => id !== needId)
      setJobField('needs', next.length === 0 ? undefined : next.length === 1 ? next[0] : next)
    },
    [needs, setJobField]
  )

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
          <div ref={dropdownRef} className="relative mt-1">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <span className="flex-shrink-0">{selectedOption.icon}</span>
              <span className="flex-1">{selectedOption.label}</span>
              <span className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {isDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded shadow-lg max-h-60 overflow-auto">
                {runnerOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleRunsOnChange(option.value)}
                    className={`w-full px-2 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-slate-50 ${
                      option.value === runsOn ? 'bg-blue-50 text-blue-700' : ''
                    }`}
                  >
                    <span className="flex-shrink-0">{option.icon}</span>
                    <span>{option.label}</span>
                  </button>
                ))}
                {!runnerOptions.some((opt) => opt.value === runsOn) && (
                  <button
                    type="button"
                    onClick={() => handleRunsOnChange(runsOn)}
                    className="w-full px-2 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-slate-50 bg-blue-50 text-blue-700"
                  >
                    <span className="flex-shrink-0">{selectedOption.icon}</span>
                    <span>{runsOn || 'ubuntu-latest'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Needs</label>
          {otherJobIds.length === 0 ? (
            <p className="mt-1 text-xs text-slate-500">No other jobs in this workflow.</p>
          ) : (
            <ul className="mt-1 space-y-1.5 rounded border border-slate-300 bg-slate-50/50 p-2">
              {otherJobIds.map((id) => (
                <li key={id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`needs-${id}`}
                    checked={needs.includes(id)}
                    onChange={(e) => toggleNeed(id, e.target.checked, e)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-slate-300 text-slate-600 focus:ring-slate-500"
                  />
                  <label htmlFor={`needs-${id}`} className="cursor-pointer text-sm text-slate-700">
                    {id}
                  </label>
                </li>
              ))}
            </ul>
          )}
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
