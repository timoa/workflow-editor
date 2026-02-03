import { useCallback, useState, useRef, useEffect } from 'react'
import type { Workflow, WorkflowJob, WorkflowStep } from '@/types/workflow'
import {
  COMMON_MATRIX_VARIABLES,
  getMatrixVariableValues,
  isCommonMatrixVariable,
} from '@/lib/matrixOptions'
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
  const [matrixVariableDropdowns, setMatrixVariableDropdowns] = useState<Record<string, boolean>>({})
  const [matrixValueDropdowns, setMatrixValueDropdowns] = useState<Record<string, boolean>>({})
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
        setMatrixVariableDropdowns({})
        setMatrixValueDropdowns({})
      }
    }
    if (isDropdownOpen || Object.keys(matrixVariableDropdowns).length > 0 || Object.keys(matrixValueDropdowns).length > 0) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen, matrixVariableDropdowns, matrixValueDropdowns])

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
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-slate-500">Environment Variables</label>
            <button
              type="button"
              onClick={() => {
                const currentEnv = job.env ?? {}
                const newEnv = { ...currentEnv, '': '' }
                setJobField('env', newEnv)
              }}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              + Add variable
            </button>
          </div>
          {!job.env || Object.keys(job.env).length === 0 ? (
            <p className="text-xs text-slate-500 italic">No environment variables configured</p>
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
                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
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
                    className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
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
                    className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 shrink-0"
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
            <label className="block text-xs font-medium text-slate-500">Matrix Strategy</label>
            <button
              type="button"
              onClick={() => {
                if (job.strategy?.matrix) {
                  setJobField('strategy', undefined)
                } else {
                  setJobField('strategy', { matrix: {} })
                }
              }}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              {job.strategy?.matrix ? 'Remove matrix' : 'Add matrix'}
            </button>
          </div>
          {job.strategy?.matrix && (
            <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3 space-y-3" data-matrix-dropdown>
              <div className="space-y-2">
                {Object.entries(job.strategy.matrix).map(([key, values]) => {
                  const isCommonVar = isCommonMatrixVariable(key)
                  const predefinedValues = getMatrixVariableValues(key)
                  const isDropdownOpen = matrixVariableDropdowns[key] ?? false
                  return (
                    <div key={key} className="rounded border border-slate-200 bg-white p-2">
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
                                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm text-left flex items-center justify-between hover:bg-slate-50"
                              >
                                <span className="font-medium">
                                  {COMMON_MATRIX_VARIABLES.find((v) => v.name === key)?.label || key}
                                </span>
                                <span className="text-slate-400">▼</span>
                              </button>
                              {isDropdownOpen && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded shadow-lg max-h-60 overflow-auto">
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
                                      className={`w-full px-2 py-1.5 text-sm text-left hover:bg-slate-50 ${
                                        option.name === key ? 'bg-blue-50 text-blue-700' : ''
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
                                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
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
                              className="w-full rounded border border-slate-300 px-2 py-1 text-sm font-medium"
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
                          className="ml-2 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 shrink-0"
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
                                    className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-sm text-left flex items-center justify-between hover:bg-slate-50"
                                  >
                                    <span className="truncate">{valueStr}</span>
                                    <span className="text-slate-400 text-xs shrink-0 ml-1">▼</span>
                                  </button>
                                  {isValueDropdownOpen && (
                                    <div className="absolute z-10 w-32 mt-1 bg-white border border-slate-300 rounded shadow-lg max-h-60 overflow-auto">
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
                                          className={`w-full px-2 py-1 text-sm text-left hover:bg-slate-50 ${
                                            predefValue === valueStr ? 'bg-blue-50 text-blue-700' : ''
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
                                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
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
                                  className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
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
                                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 shrink-0"
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
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        + Add value
                      </button>
                    </div>
                  </div>
                )
                })}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setMatrixVariableDropdowns((prev) => ({
                        ...prev,
                        '__new__': !prev['__new__'],
                      }))
                    }
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>+ Add matrix variable</span>
                    <span className="text-slate-400">▼</span>
                  </button>
                  {matrixVariableDropdowns['__new__'] && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded shadow-lg max-h-60 overflow-auto">
                      {COMMON_MATRIX_VARIABLES.map((option) => (
                        <button
                          key={option.name}
                          type="button"
                          onClick={() => {
                            const newMatrix = { ...job.strategy!.matrix! }
                            newMatrix[option.name] = [option.values[0]]
                            setJobField('strategy', {
                              ...job.strategy,
                              matrix: newMatrix,
                            })
                            setMatrixVariableDropdowns((prev) => ({
                              ...prev,
                              '__new__': false,
                            }))
                          }}
                          className="w-full px-2 py-1.5 text-sm text-left hover:bg-slate-50"
                        >
                          {option.label}
                        </button>
                      ))}
                      <div className="border-t border-slate-200 px-2 py-1">
                        <input
                          type="text"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const input = e.currentTarget
                              const newMatrix = { ...job.strategy!.matrix!, [input.value]: [''] }
                              setJobField('strategy', {
                                ...job.strategy,
                                matrix: newMatrix,
                              })
                              setMatrixVariableDropdowns((prev) => ({
                                ...prev,
                                '__new__': false,
                              }))
                              input.value = ''
                            }
                          }}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          placeholder="Custom variable name (Enter)"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 border-t border-slate-200 pt-2">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={job.strategy['fail-fast'] !== false}
                    onChange={(e) => {
                      setJobField('strategy', {
                        ...job.strategy,
                        'fail-fast': e.target.checked ? undefined : false,
                      })
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-slate-600"
                  />
                  <span>Fail fast (default: true)</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Max parallel:</label>
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
                    className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                    placeholder="∞"
                    min="1"
                  />
                </div>
              </div>
            </div>
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
                  {step.uses && (
                    <div className="rounded border border-slate-200 bg-white p-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-slate-600">With (action inputs)</label>
                        <button
                          type="button"
                          onClick={() => {
                            if (step.with && Object.keys(step.with).length > 0) {
                              updateStep(index, (s) => ({ ...s, with: undefined }))
                            } else {
                              updateStep(index, (s) => ({ ...s, with: {} }))
                            }
                          }}
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          {step.with && Object.keys(step.with).length > 0 ? 'Remove' : 'Add'}
                        </button>
                      </div>
                      {step.with && Object.keys(step.with).length > 0 && (
                        <div className="space-y-1.5 mt-2">
                          {Object.entries(step.with).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-1.5">
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
                                className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
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
                                className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
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
                                className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 shrink-0"
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
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            + Add input
                          </button>
                        </div>
                      )}
                    </div>
                  )}
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
      {onDeleteJob && (
        <div className="flex justify-center border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={() => onDeleteJob(jobId)}
            className="rounded border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            aria-label={`Delete job ${jobId}`}
          >
            Delete job
          </button>
        </div>
      )}
    </aside>
  )
}
