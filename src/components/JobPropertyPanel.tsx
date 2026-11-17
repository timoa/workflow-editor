import { useCallback, useMemo, useState, useRef, useEffect } from 'react'
import type { Workflow, WorkflowJob, WorkflowStep } from '@/types/workflow'
import { isReusableCallerJob } from '@/types/workflow'
import {
  COMMON_MATRIX_VARIABLES,
  getMatrixVariableValues,
  isCommonMatrixVariable,
} from '@/lib/matrixOptions'
import { mergeMatrixEntry } from '@/lib/matrixUtils'
import { RUNNER_OPTIONS } from '@/lib/runnerConfig'
import { SiUbuntu, SiApple } from 'react-icons/si'
import { FaWindows } from 'react-icons/fa'
import { HiServer, HiPencil } from 'react-icons/hi'
import { RunScriptDialog } from './RunScriptDialog'

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
  onDeleteJob?: (jobId: string) => void
}

export function JobPropertyPanel({
  workflow,
  jobId,
  onWorkflowChange,
  onClose,
  onDeleteJob,
}: JobPropertyPanelProps) {
  const job = workflow.jobs[jobId]

  const updateJob = useCallback(
    (updater: (j: WorkflowJob) => WorkflowJob) => {
      const next = { ...workflow, jobs: { ...workflow.jobs } }
      if (!next.jobs[jobId]) return
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

  const [runDialogStepIndex, setRunDialogStepIndex] = useState<number | null>(null)

  const runsOn = job
    ? Array.isArray(job['runs-on'])
      ? job['runs-on'].join(', ')
      : String(job['runs-on'] ?? '')
    : ''
  const needs = useMemo(
    () =>
      job?.needs
        ? Array.isArray(job.needs)
          ? job.needs
          : [job.needs]
        : [],
    [job?.needs]
  )

  const otherJobIds = Object.keys(workflow.jobs).filter((id) => id !== jobId)

  const runnerOptions = useMemo(() => {
    const icons = {
      linux: getLinuxIcon,
      mac: getMacIcon,
      windows: getWindowsIcon,
      server: getServerIcon,
    }
    return RUNNER_OPTIONS.map((opt) => ({
      value: opt.value,
      label: opt.label,
      icon: icons[opt.iconType](),
    }))
  }, [])

  const selectedOption = runnerOptions.find((opt) => opt.value === runsOn) || {
    value: runsOn,
    label: runsOn || 'ubuntu-latest',
    icon: getLinuxIcon(),
  }

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [addPredefinedOpen, setAddPredefinedOpen] = useState(false)
  const [matrixVariableDropdowns, setMatrixVariableDropdowns] = useState<Record<string, boolean>>({})
  const [matrixValueDropdowns, setMatrixValueDropdowns] = useState<Record<string, boolean>>({})
  const [customMatrixName, setCustomMatrixName] = useState('')
  const [customMatrixValues, setCustomMatrixValues] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
      // Close matrix dropdowns when clicking outside
      const target = event.target as Node
      if (!(target instanceof Element)) return
      const isInsideMatrixDropdown = target.closest('[data-matrix-dropdown]')
      if (!isInsideMatrixDropdown) {
        setAddPredefinedOpen(false)
        setMatrixVariableDropdowns({})
        setMatrixValueDropdowns({})
      }
    }
    if (isDropdownOpen || addPredefinedOpen || Object.keys(matrixVariableDropdowns).length > 0 || Object.keys(matrixValueDropdowns).length > 0) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen, addPredefinedOpen, matrixVariableDropdowns, matrixValueDropdowns])

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

  if (!job) return null

  const isReusable = isReusableCallerJob(job)

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-2">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Job: {jobId}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300"
          aria-label="Close panel"
        >
          <span className="text-lg leading-none">×</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Display name</label>
          <input
            type="text"
            value={job.name ?? ''}
            onChange={(e) => setJobField('name', e.target.value || undefined)}
            className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1.5 text-sm"
            placeholder={jobId}
          />
        </div>
        {isReusable ? (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Reusable workflow</label>
              <p className="mt-1 break-all rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 px-2 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300">
                {job.uses}
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Inputs (with)</label>
                <button
                  type="button"
                  onClick={() => {
                    const currentWith = job.with ?? {}
                    setJobField('with', { ...currentWith, '': '' })
                  }}
                  className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
                >
                  + Add input
                </button>
              </div>
              {!job.with || Object.keys(job.with).length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">No inputs configured</p>
              ) : (
                <div className="space-y-1.5">
                  {Object.entries(job.with).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={key}
                        onChange={(e) => {
                          const newWith = { ...(job.with ?? {}) }
                          delete newWith[key]
                          newWith[e.target.value] = value
                          setJobField('with', newWith)
                        }}
                        className="w-1/3 flex-shrink-0 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1 text-xs"
                        placeholder="Input name"
                      />
                      <input
                        type="text"
                        value={String(value ?? '')}
                        onChange={(e) => {
                          const newWith = { ...(job.with ?? {}), [key]: e.target.value }
                          setJobField('with', newWith)
                        }}
                        className="flex-1 font-mono rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1 text-xs"
                        placeholder="Value"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newWith = { ...(job.with ?? {}) }
                          delete newWith[key]
                          setJobField('with', Object.keys(newWith).length > 0 ? newWith : undefined)
                        }}
                        className="rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Secrets</label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={job.secrets === 'inherit'}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setJobField('secrets', 'inherit')
                        } else {
                          setJobField('secrets', undefined)
                        }
                      }}
                      className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600"
                    />
                    inherit
                  </label>
                  {job.secrets !== 'inherit' && (
                    <button
                      type="button"
                      onClick={() => {
                        const current = (job.secrets as Record<string, string> | undefined) ?? {}
                        setJobField('secrets', { ...current, '': '' })
                      }}
                      className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
                    >
                      + Add secret
                    </button>
                  )}
                </div>
              </div>
              {job.secrets === 'inherit' ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">All secrets inherited from caller</p>
              ) : !job.secrets || Object.keys(job.secrets).length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">No secrets configured</p>
              ) : (
                <div className="space-y-1.5">
                  {Object.entries(job.secrets as Record<string, string>).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={key}
                        onChange={(e) => {
                          const current = (job.secrets as Record<string, string> | undefined) ?? {}
                          const updated = { ...current }
                          delete updated[key]
                          updated[e.target.value] = value
                          setJobField('secrets', updated)
                        }}
                        className="w-1/3 flex-shrink-0 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1 text-xs"
                        placeholder="Secret name"
                      />
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => {
                          const current = (job.secrets as Record<string, string> | undefined) ?? {}
                          setJobField('secrets', { ...current, [key]: e.target.value })
                        }}
                        className="flex-1 font-mono rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1 text-xs"
                        placeholder="${{ secrets.MY_SECRET }}"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const current = (job.secrets as Record<string, string> | undefined) ?? {}
                          const updated = { ...current }
                          delete updated[key]
                          setJobField('secrets', Object.keys(updated).length > 0 ? updated : undefined)
                        }}
                        className="rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Runs on</label>
            <div ref={dropdownRef} className="relative mt-1">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 dark:text-slate-200"
              >
                <span className="flex-shrink-0">{selectedOption.icon}</span>
                <span className="flex-1">{selectedOption.label}</span>
                <span className={`text-slate-400 dark:text-slate-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded shadow-lg max-h-60 overflow-auto">
                  {runnerOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleRunsOnChange(option.value)}
                      className={`w-full px-2 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 ${
                        option.value === runsOn ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-slate-200'
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
                      className="w-full px-2 py-1.5 text-sm text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    >
                      <span className="flex-shrink-0">{selectedOption.icon}</span>
                      <span>{runsOn || 'ubuntu-latest'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Needs</label>
          {otherJobIds.length === 0 ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">No other jobs in this workflow.</p>
          ) : (
            <ul className="mt-1 space-y-1.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 p-2">
              {otherJobIds.map((id) => (
                <li key={id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`needs-${id}`}
                    checked={needs.includes(id)}
                    onChange={(e) => toggleNeed(id, e.target.checked, e)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 focus:ring-slate-500 dark:focus:ring-slate-400"
                  />
                  <label htmlFor={`needs-${id}`} className="cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                    {id}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        {!isReusable && <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Environment Variables</label>
            <button
              type="button"
              onClick={() => {
                const currentEnv = job.env ?? {}
                const newEnv = { ...currentEnv, '': '' }
                setJobField('env', newEnv)
              }}
              className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
            >
              + Add variable
            </button>
          </div>
          {!job.env || Object.keys(job.env).length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">No environment variables configured</p>
          ) : (
            <div className="space-y-1.5">
              {Object.entries(job.env).map(([key, value]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => {
                      const currentEnv = job.env ?? {}
                      const newEnv = { ...currentEnv }
                      delete newEnv[key]
                      newEnv[e.target.value] = value
                      setJobField('env', Object.keys(newEnv).length > 0 ? newEnv : undefined)
                    }}
                    className="flex-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1 text-sm"
                    placeholder="Variable name"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                      const currentEnv = job.env ?? {}
                      const newEnv = { ...currentEnv }
                      if (e.target.value === '') {
                        delete newEnv[key]
                      } else {
                        newEnv[key] = e.target.value
                      }
                      setJobField('env', Object.keys(newEnv).length > 0 ? newEnv : undefined)
                    }}
                    className="flex-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1 text-sm"
                    placeholder="Value"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const currentEnv = job.env ?? {}
                      const newEnv = { ...currentEnv }
                      delete newEnv[key]
                      setJobField('env', Object.keys(newEnv).length > 0 ? newEnv : undefined)
                    }}
                    className="rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>}

        {!isReusable && <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Matrix Strategy</label>
            <button
              type="button"
              onClick={() => {
                if (job.strategy?.matrix) {
                  setJobField('strategy', undefined)
                } else {
                  setJobField('strategy', { matrix: {} })
                }
              }}
              className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
            >
              {job.strategy?.matrix ? 'Remove matrix' : 'Add matrix'}
            </button>
          </div>
          {job.strategy?.matrix && (
            <div className="mb-4 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 p-3 space-y-3" data-matrix-dropdown>
              <div className="space-y-2">
                {Object.entries(job.strategy.matrix).map(([key, values]) => {
                  const isCommonVar = isCommonMatrixVariable(key)
                  const predefinedValues = getMatrixVariableValues(key)
                  const isDropdownOpen = matrixVariableDropdowns[key] ?? false
                  return (
                    <div key={key} className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="relative flex-1">
                          {isCommonVar ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setMatrixVariableDropdowns((prev) => ({
                                    ...prev,
                                    [key]: !prev[key],
                                  }))
                                }
                                className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-sm text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-200"
                              >
                                <span className="font-medium">
                                  {COMMON_MATRIX_VARIABLES.find((v) => v.name === key)?.label || key}
                                </span>
                                <span className="text-slate-400 dark:text-slate-500">▼</span>
                              </button>
                              {isDropdownOpen && (
                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded shadow-lg max-h-60 overflow-auto">
                                  {COMMON_MATRIX_VARIABLES.map((option) => (
                                    <button
                                      key={option.name}
                                      type="button"
                                      onClick={() => {
                                        const newMatrix = { ...job.strategy!.matrix! }
                                        delete newMatrix[key]
                                        // If switching to a predefined variable, use its default values if current values are empty
                                        const currentValues = Array.isArray(values) ? values : []
                                        newMatrix[option.name] =
                                          currentValues.length > 0 ? currentValues : [option.values[0]]
                                        setJobField('strategy', {
                                          ...job.strategy,
                                          matrix: newMatrix,
                                        })
                                        setMatrixVariableDropdowns((prev) => ({
                                          ...prev,
                                          [key]: false,
                                        }))
                                      }}
                                      className={`w-full px-2 py-1.5 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700 ${
                                        option.name === key ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-slate-200'
                                      }`}
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                  <div className="border-t border-slate-200 px-2 py-1.5">
                                    <input
                                      type="text"
                                      value={key}
                                      onChange={(e) => {
                                        const newMatrix = { ...job.strategy!.matrix! }
                                        delete newMatrix[key]
                                        newMatrix[e.target.value] = values
                                        setJobField('strategy', {
                                          ...job.strategy,
                                          matrix: newMatrix,
                                        })
                                      }}
                                      className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1 text-sm"
                                      placeholder="Custom variable name"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <input
                              type="text"
                              value={key}
                              onChange={(e) => {
                                const newMatrix = { ...job.strategy!.matrix! }
                                delete newMatrix[key]
                                newMatrix[e.target.value] = values
                                setJobField('strategy', {
                                  ...job.strategy,
                                  matrix: newMatrix,
                                })
                              }}
                              className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1 text-sm font-medium"
                              placeholder="Variable name"
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newMatrix = { ...job.strategy!.matrix! }
                            delete newMatrix[key]
                            setJobField('strategy', {
                              ...job.strategy,
                              matrix: Object.keys(newMatrix).length > 0 ? newMatrix : undefined,
                            })
                          }}
                          className="ml-2 rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    <div className="space-y-1.5">
                      {Array.isArray(values) &&
                        values.map((value, valueIdx) => {
                          const valueStr = String(value)
                          const isValueDropdownOpen = matrixValueDropdowns[`${key}-${valueIdx}`] ?? false
                          const hasPredefinedValues = predefinedValues !== null
                          return (
                            <div key={valueIdx} className="flex items-center gap-1.5">
                              {hasPredefinedValues ? (
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMatrixValueDropdowns((prev) => ({
                                        ...prev,
                                        [`${key}-${valueIdx}`]: !prev[`${key}-${valueIdx}`],
                                      }))
                                    }
                                    className="w-24 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-sm text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-200"
                                  >
                                    <span className="truncate">{valueStr}</span>
                                    <span className="text-slate-400 dark:text-slate-500 text-xs shrink-0 ml-1">▼</span>
                                  </button>
                                  {isValueDropdownOpen && (
                                    <div className="absolute z-10 w-32 mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded shadow-lg max-h-60 overflow-auto">
                                      {predefinedValues.map((predefValue) => (
                                        <button
                                          key={predefValue}
                                          type="button"
                                          onClick={() => {
                                            const newMatrix = { ...job.strategy!.matrix! }
                                            const currentValues = newMatrix[key] ?? []
                                            const newValues = [...currentValues]
                                            newValues[valueIdx] = predefValue
                                            newMatrix[key] = newValues as string[] | number[]
                                            setJobField('strategy', {
                                              ...job.strategy,
                                              matrix: newMatrix,
                                            })
                                            setMatrixValueDropdowns((prev) => ({
                                              ...prev,
                                              [`${key}-${valueIdx}`]: false,
                                            }))
                                          }}
                                          className={`w-full px-2 py-1 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700 ${
                                            predefValue === valueStr ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-slate-200'
                                          }`}
                                        >
                                          {predefValue}
                                        </button>
                                      ))}
                                      <div className="border-t border-slate-200 px-2 py-1">
                                        <input
                                          type="text"
                                          value={valueStr}
                                          onChange={(e) => {
                                            const newMatrix = { ...job.strategy!.matrix! }
                                            const currentValues = newMatrix[key] ?? []
                                            const newValues = [...currentValues]
                                            const numValue = Number(e.target.value)
                                            const isNumberArray =
                                              currentValues.length > 0 && typeof currentValues[0] === 'number'
                                            if (isNumberArray && !Number.isNaN(numValue) && e.target.value.trim() !== '') {
                                              newValues[valueIdx] = numValue
                                            } else {
                                              newValues[valueIdx] = e.target.value
                                            }
                                            newMatrix[key] = newValues as string[] | number[]
                                            setJobField('strategy', {
                                              ...job.strategy,
                                              matrix: newMatrix,
                                            })
                                          }}
                                          className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1 text-sm"
                                          placeholder="Custom value"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={valueStr}
                                  onChange={(e) => {
                                    const newMatrix = { ...job.strategy!.matrix! }
                                    const currentValues = newMatrix[key] ?? []
                                    const newValues = [...currentValues]
                                    const numValue = Number(e.target.value)
                                    const isNumberArray =
                                      currentValues.length > 0 && typeof currentValues[0] === 'number'
                                    if (isNumberArray && !Number.isNaN(numValue) && e.target.value.trim() !== '') {
                                      newValues[valueIdx] = numValue
                                    } else {
                                      newValues[valueIdx] = e.target.value
                                    }
                                    newMatrix[key] = newValues as string[] | number[]
                                    setJobField('strategy', {
                                      ...job.strategy,
                                      matrix: newMatrix,
                                    })
                                  }}
                                  className="w-24 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1 text-sm"
                                  placeholder="Value"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const newMatrix = { ...job.strategy!.matrix! }
                                  const currentValues = newMatrix[key] ?? []
                                  const newValues = currentValues.filter((_, i) => i !== valueIdx)
                                  if (newValues.length > 0) {
                                    newMatrix[key] = newValues as string[] | number[]
                                  } else {
                                    delete newMatrix[key]
                                  }
                                  setJobField('strategy', {
                                    ...job.strategy,
                                    matrix: Object.keys(newMatrix).length > 0 ? newMatrix : undefined,
                                  })
                                }}
                                className="rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
                              >
                                ×
                              </button>
                            </div>
                          )
                        })}
                      <button
                        type="button"
                        onClick={() => {
                          const newMatrix = { ...job.strategy!.matrix! }
                          const currentValues = newMatrix[key] ?? []
                          const defaultValue = predefinedValues && predefinedValues.length > 0 ? predefinedValues[0] : ''
                          const newValues = [...currentValues, defaultValue]
                          newMatrix[key] = newValues as string[] | number[]
                          setJobField('strategy', {
                            ...job.strategy,
                            matrix: newMatrix,
                          })
                        }}
                        className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
                      >
                        + Add value
                      </button>
                    </div>
                  </div>
                )
                })}
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Predefined (language/version)</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setAddPredefinedOpen((prev) => !prev)}
                        className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center justify-between"
                      >
                        <span>+ Add predefined variable</span>
                        <span className="text-slate-400 dark:text-slate-500">▼</span>
                      </button>
                      {addPredefinedOpen && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded shadow-lg max-h-60 overflow-auto">
                          {COMMON_MATRIX_VARIABLES.map((option) => (
                            <button
                              key={option.name}
                              type="button"
                              onClick={() => {
                                const newMatrix = mergeMatrixEntry(
                                  job.strategy!.matrix!,
                                  option.name,
                                  [option.values[0]]
                                )
                                setJobField('strategy', {
                                  ...job.strategy,
                                  matrix: newMatrix,
                                })
                                setAddPredefinedOpen(false)
                              }}
                              className="w-full px-2 py-1.5 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-200"
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Custom variables</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customMatrixName}
                        onChange={(e) => setCustomMatrixName(e.target.value)}
                        className="flex-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1 text-sm"
                        placeholder="Variable name"
                      />
                      <input
                        type="text"
                        value={customMatrixValues}
                        onChange={(e) => setCustomMatrixValues(e.target.value)}
                        className="flex-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1 text-sm"
                        placeholder="value1, value2, value3"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const name = customMatrixName.trim()
                          const values = customMatrixValues
                            .split(',')
                            .map((v) => v.trim())
                            .filter(Boolean)
                          if (name && values.length > 0) {
                            const newMatrix = mergeMatrixEntry(
                              job.strategy!.matrix!,
                              name,
                              values
                            )
                            setJobField('strategy', {
                              ...job.strategy,
                              matrix: newMatrix,
                            })
                            setCustomMatrixName('')
                            setCustomMatrixValues('')
                          }
                        }}
                        disabled={
                          !customMatrixName.trim() ||
                          customMatrixValues.split(',').map((v) => v.trim()).filter(Boolean).length === 0
                        }
                        className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 border-t border-slate-200 dark:border-slate-700 pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-900 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={job.strategy['fail-fast'] !== false}
                    onChange={(e) => {
                      setJobField('strategy', {
                        ...job.strategy,
                        'fail-fast': e.target.checked ? undefined : false,
                      })
                    }}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400"
                  />
                  <span>Fail fast (default: true)</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 dark:text-slate-400">Max parallel:</label>
                  <input
                    type="number"
                    value={job.strategy['max-parallel'] ?? ''}
                    onChange={(e) => {
                      const value = e.target.value === '' ? undefined : Number(e.target.value)
                      setJobField('strategy', {
                        ...job.strategy,
                        'max-parallel': value,
                      })
                    }}
                    className="w-20 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1 text-sm"
                    placeholder="∞"
                    min="1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>}

        {!isReusable && <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Steps</label>
            <button
              type="button"
              onClick={addStep}
              className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
            >
              Add step
            </button>
          </div>
          <ul className="mt-2 space-y-3">
            {(job.steps ?? []).map((step, index) => (
              <li key={`step-${step.name ?? 'unnamed'}-${index}`} className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Step {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    className="rounded p-0.5 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
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
                    className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1 text-sm"
                    placeholder="Step name"
                  />
                  <input
                    type="text"
                    value={step.uses ?? ''}
                    onChange={(e) => updateStep(index, (s) => ({ ...s, uses: e.target.value || undefined }))}
                    className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1 text-sm"
                    placeholder="uses: actions/checkout@v4"
                  />
                  {step.uses && (
                    <div className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">With (action inputs)</label>
                        <button
                          type="button"
                          onClick={() => {
                            if (step.with && Object.keys(step.with).length > 0) {
                              updateStep(index, (s) => ({ ...s, with: undefined }))
                            } else {
                              // Initialize with an empty key-value pair so the inputs appear
                              updateStep(index, (s) => ({ ...s, with: { '': '' } }))
                            }
                          }}
                          className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                          {step.with && Object.keys(step.with).length > 0 ? 'Remove' : 'Add'}
                        </button>
                      </div>
                      {step.with && Object.keys(step.with).length > 0 && (
                        <div className="space-y-1.5 mt-2">
                          {Object.entries(step.with).map(([key, value], entryIndex) => (
                            <div key={entryIndex} className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={key}
                                onChange={(e) => {
                                  const newWith = { ...step.with! }
                                  delete newWith[key]
                                  newWith[e.target.value] = value
                                  updateStep(index, (s) => ({
                                    ...s,
                                    with: Object.keys(newWith).length > 0 ? newWith : undefined,
                                  }))
                                }}
                                className="w-1/3 flex-shrink-0 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1 text-xs"
                                placeholder="Input name"
                              />
                              <input
                                type="text"
                                value={String(value)}
                                onChange={(e) => {
                                  const newWith = { ...step.with! }
                                  // Try to preserve type: if original was number, try to convert
                                  const numValue = Number(e.target.value)
                                  if (typeof value === 'number' && !Number.isNaN(numValue) && e.target.value.trim() !== '') {
                                    newWith[key] = numValue
                                  } else {
                                    newWith[key] = e.target.value
                                  }
                                  updateStep(index, (s) => ({ ...s, with: newWith }))
                                }}
                                className="flex-1 font-mono rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-2 py-1 text-xs"
                                placeholder="Value"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const newWith = { ...step.with! }
                                  delete newWith[key]
                                  updateStep(index, (s) => ({
                                    ...s,
                                    with: Object.keys(newWith).length > 0 ? newWith : undefined,
                                  }))
                                }}
                                className="rounded p-0.5 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const newWith = { ...step.with!, '': '' }
                              updateStep(index, (s) => ({ ...s, with: newWith }))
                            }}
                            className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
                          >
                            + Add input
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-1">
                    <div className="flex-1 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-1.5 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300 min-h-[2.5rem] overflow-hidden text-ellipsis whitespace-nowrap">
                      {(step.run ?? '').trim().split('\n')[0] || 'run: ...'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setRunDialogStepIndex(index)}
                      className="rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
                      aria-label="Edit script"
                    >
                      <HiPencil size={14} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>}
      </div>
      {onDeleteJob && (
        <div
          className="flex justify-center border-t border-slate-200 dark:border-slate-700 p-4"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (onDeleteJob) {
                onDeleteJob(jobId)
              }
            }}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            className="rounded border border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 cursor-pointer"
            aria-label={`Delete job ${jobId}`}
          >
            Delete job
          </button>
        </div>
      )}
      {runDialogStepIndex !== null && job?.steps?.[runDialogStepIndex] && (
        <RunScriptDialog
          initialValue={job.steps[runDialogStepIndex]?.run ?? ''}
          stepLabel={`Step ${runDialogStepIndex + 1}${job.steps[runDialogStepIndex]?.name ? `: ${job.steps[runDialogStepIndex].name}` : ''}`}
          onSave={(value) => {
            updateStep(runDialogStepIndex, (s) => ({ ...s, run: value || undefined }))
            setRunDialogStepIndex(null)
          }}
          onClose={() => setRunDialogStepIndex(null)}
        />
      )}
    </aside>
  )
}
