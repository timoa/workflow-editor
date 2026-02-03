import { useCallback, useState } from 'react'
import type { Workflow } from '@/types/workflow'
import type { ParsedTrigger, TriggerConfig } from '@/lib/triggerUtils'
import { parseTriggers, triggersToOn, triggerSupportsTypes } from '@/lib/triggerUtils'

interface TriggerPropertyPanelProps {
  workflow: Workflow
  onWorkflowChange: (workflow: Workflow) => void
  onClose: () => void
}

const TRIGGER_TYPES = [
  { value: 'push', label: 'Push' },
  { value: 'pull_request', label: 'Pull Request' },
  { value: 'pull_request_target', label: 'Pull Request Target' },
  { value: 'pull_request_review', label: 'Pull Request Review' },
  { value: 'pull_request_review_comment', label: 'Pull Request Review Comment' },
  { value: 'workflow_dispatch', label: 'Workflow Dispatch' },
  { value: 'repository_dispatch', label: 'Repository Dispatch' },
  { value: 'schedule', label: 'Schedule (Cron)' },
  { value: 'workflow_call', label: 'Workflow Call' },
  { value: 'workflow_run', label: 'Workflow Run' },
  { value: 'issues', label: 'Issues' },
  { value: 'issue_comment', label: 'Issue Comment' },
  { value: 'label', label: 'Label' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'project', label: 'Project' },
  { value: 'project_card', label: 'Project Card' },
  { value: 'project_column', label: 'Project Column' },
  { value: 'release', label: 'Release' },
  { value: 'watch', label: 'Watch' },
  { value: 'create', label: 'Create' },
  { value: 'delete', label: 'Delete' },
  { value: 'fork', label: 'Fork' },
  { value: 'gollum', label: 'Gollum (Wiki)' },
  { value: 'page_build', label: 'Page Build' },
  { value: 'public', label: 'Public' },
  { value: 'status', label: 'Status' },
  { value: 'branch_protection_rule', label: 'Branch Protection Rule' },
  { value: 'check_run', label: 'Check Run' },
  { value: 'check_suite', label: 'Check Suite' },
  { value: 'discussion', label: 'Discussion' },
  { value: 'discussion_comment', label: 'Discussion Comment' },
  { value: 'merge_group', label: 'Merge Group' },
  { value: 'registry_package', label: 'Registry Package' },
]

export function TriggerPropertyPanel({
  workflow,
  onWorkflowChange,
  onClose,
}: TriggerPropertyPanelProps) {
  const [triggers, setTriggers] = useState<ParsedTrigger[]>(() => parseTriggers(workflow.on))

  const updateTriggers = useCallback(
    (newTriggers: ParsedTrigger[]) => {
      setTriggers(newTriggers)
      const newOn = triggersToOn(newTriggers)
      onWorkflowChange({ ...workflow, on: newOn })
    },
    [workflow, onWorkflowChange]
  )

  const addTrigger = useCallback(() => {
    updateTriggers([...triggers, { event: 'push', config: {} }])
  }, [triggers, updateTriggers])

  const removeTrigger = useCallback(
    (index: number) => {
      updateTriggers(triggers.filter((_, i) => i !== index))
    },
    [triggers, updateTriggers]
  )

  const updateTrigger = useCallback(
    (index: number, updater: (t: ParsedTrigger) => ParsedTrigger) => {
      const newTriggers = [...triggers]
      newTriggers[index] = updater(newTriggers[index])
      updateTriggers(newTriggers)
    },
    [triggers, updateTriggers]
  )

  const updateTriggerConfig = useCallback(
    (index: number, key: keyof TriggerConfig, value: unknown) => {
      updateTrigger(index, (t) => ({
        ...t,
        config: { ...t.config, [key]: value },
      }))
    },
    [updateTrigger]
  )

  const addArrayItem = useCallback(
    (index: number, key: 'branches' | 'tags' | 'paths' | 'pathsIgnore' | 'types', value: string) => {
      const trigger = triggers[index]
      const current = (trigger.config[key] as string[]) ?? []
      if (value && !current.includes(value)) {
        updateTriggerConfig(index, key, [...current, value])
      }
    },
    [triggers, updateTriggerConfig]
  )

  const removeArrayItem = useCallback(
    (index: number, key: 'branches' | 'tags' | 'paths' | 'pathsIgnore' | 'types', itemIndex: number) => {
      const trigger = triggers[index]
      const current = (trigger.config[key] as string[]) ?? []
      updateTriggerConfig(index, key, current.filter((_, i) => i !== itemIndex))
    },
    [updateTriggerConfig]
  )

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <h2 className="text-sm font-semibold text-slate-800">Workflow Triggers</h2>
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
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-slate-500">Triggers</label>
            <button
              type="button"
              onClick={addTrigger}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              + Add Trigger
            </button>
          </div>
          {triggers.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No triggers configured</p>
          ) : (
            <div className="space-y-3">
              {triggers.map((trigger, index) => (
                <div key={index} className="rounded border border-slate-200 bg-slate-50 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">Trigger {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeTrigger(index)}
                      className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                      aria-label={`Remove trigger ${index + 1}`}
                    >
                      ×
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Event Type</label>
                    <select
                      value={trigger.event}
                      onChange={(e) => updateTrigger(index, (t) => ({ ...t, event: e.target.value, config: {} }))}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      {TRIGGER_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Branches */}
                  {(trigger.event === 'push' || trigger.event === 'pull_request') && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Branches</label>
                      <div className="space-y-1.5">
                        {(trigger.config.branches ?? []).map((branch, branchIdx) => (
                          <div key={branchIdx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={branch}
                              onChange={(e) => {
                                const branches = [...(trigger.config.branches ?? [])]
                                branches[branchIdx] = e.target.value
                                updateTriggerConfig(index, 'branches', branches)
                              }}
                              className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                              placeholder="main"
                            />
                            <button
                              type="button"
                              onClick={() => removeArrayItem(index, 'branches', branchIdx)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <input
                          type="text"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const input = e.currentTarget
                              addArrayItem(index, 'branches', input.value)
                              input.value = ''
                            }
                          }}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          placeholder="Press Enter to add branch"
                        />
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {trigger.event === 'push' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Tags</label>
                      <div className="space-y-1.5">
                        {(trigger.config.tags ?? []).map((tag, tagIdx) => (
                          <div key={tagIdx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={tag}
                              onChange={(e) => {
                                const tags = [...(trigger.config.tags ?? [])]
                                tags[tagIdx] = e.target.value
                                updateTriggerConfig(index, 'tags', tags)
                              }}
                              className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                              placeholder="v*"
                            />
                            <button
                              type="button"
                              onClick={() => removeArrayItem(index, 'tags', tagIdx)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <input
                          type="text"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const input = e.currentTarget
                              addArrayItem(index, 'tags', input.value)
                              input.value = ''
                            }
                          }}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          placeholder="Press Enter to add tag"
                        />
                      </div>
                    </div>
                  )}

                  {/* Types (for triggers that support activity types) */}
                  {triggerSupportsTypes(trigger.event) && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Types (optional)</label>
                      {trigger.event === 'repository_dispatch' && (
                        <p className="text-xs text-slate-500 mb-1">Filter by custom event type sent via API</p>
                      )}
                      {trigger.event === 'release' && (
                        <p className="text-xs text-slate-500 mb-1">e.g. published, unpublished, created, prereleased, released</p>
                      )}
                      {trigger.event === 'pull_request' && (
                        <p className="text-xs text-slate-500 mb-1">e.g. opened, synchronize, closed, labeled, etc.</p>
                      )}
                      {trigger.event === 'workflow_run' && (
                        <p className="text-xs text-slate-500 mb-1">e.g. completed, requested, in_progress</p>
                      )}
                      <div className="space-y-1.5">
                        {(trigger.config.types ?? []).map((type, typeIdx) => (
                          <div key={typeIdx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={type}
                              onChange={(e) => {
                                const types = [...(trigger.config.types ?? [])]
                                types[typeIdx] = e.target.value
                                updateTriggerConfig(index, 'types', types)
                              }}
                              className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                              placeholder={
                                trigger.event === 'release' ? 'published' :
                                trigger.event === 'repository_dispatch' ? 'deploy' :
                                trigger.event === 'pull_request' ? 'opened' :
                                trigger.event === 'workflow_run' ? 'completed' :
                                'activity_type'
                              }
                            />
                            <button
                              type="button"
                              onClick={() => removeArrayItem(index, 'types', typeIdx)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <input
                          type="text"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const input = e.currentTarget
                              addArrayItem(index, 'types', input.value)
                              input.value = ''
                            }
                          }}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          placeholder="Press Enter to add type"
                        />
                      </div>
                    </div>
                  )}

                  {/* Paths */}
                  {(trigger.event === 'push' || trigger.event === 'pull_request') && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Paths</label>
                      <div className="space-y-1.5">
                        {(trigger.config.paths ?? []).map((path, pathIdx) => (
                          <div key={pathIdx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={path}
                              onChange={(e) => {
                                const paths = [...(trigger.config.paths ?? [])]
                                paths[pathIdx] = e.target.value
                                updateTriggerConfig(index, 'paths', paths)
                              }}
                              className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                              placeholder="src/**"
                            />
                            <button
                              type="button"
                              onClick={() => removeArrayItem(index, 'paths', pathIdx)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <input
                          type="text"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const input = e.currentTarget
                              addArrayItem(index, 'paths', input.value)
                              input.value = ''
                            }
                          }}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          placeholder="Press Enter to add path"
                        />
                      </div>
                    </div>
                  )}

                  {/* Paths Ignore */}
                  {(trigger.event === 'push' || trigger.event === 'pull_request') && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Paths Ignore</label>
                      <div className="space-y-1.5">
                        {(trigger.config.pathsIgnore ?? []).map((path, pathIdx) => (
                          <div key={pathIdx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={path}
                              onChange={(e) => {
                                const pathsIgnore = [...(trigger.config.pathsIgnore ?? [])]
                                pathsIgnore[pathIdx] = e.target.value
                                updateTriggerConfig(index, 'pathsIgnore', pathsIgnore)
                              }}
                              className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                              placeholder="docs/**"
                            />
                            <button
                              type="button"
                              onClick={() => removeArrayItem(index, 'pathsIgnore', pathIdx)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <input
                          type="text"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const input = e.currentTarget
                              addArrayItem(index, 'pathsIgnore', input.value)
                              input.value = ''
                            }
                          }}
                          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          placeholder="Press Enter to add path"
                        />
                      </div>
                    </div>
                  )}


                  {/* Schedule Cron */}
                  {trigger.event === 'schedule' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Cron Expression</label>
                      <input
                        type="text"
                        value={(trigger.config.cron as string) ?? ''}
                        onChange={(e) => updateTriggerConfig(index, 'cron', e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-mono"
                        placeholder="0 0 * * *"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Format: minute hour day month weekday (e.g., "0 0 * * *" for daily at midnight)
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
