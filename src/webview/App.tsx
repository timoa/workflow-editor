import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  // MiniMap,
  ReactFlowProvider,
  type Node,
  type OnSelectionChangeFunc,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { HiCog, HiFolderOpen, HiCode } from 'react-icons/hi'
import { FaBroom, FaBug } from 'react-icons/fa'
import { AddJobNode } from './components/AddJobNode'
import { JobNode } from './components/JobNode'
import { JobPropertyPanel } from './components/JobPropertyPanel'
import { TriggerNode } from './components/TriggerNode'
import { TriggerPropertyPanel } from './components/TriggerPropertyPanel'
import { WorkflowPropertyPanel } from './components/WorkflowPropertyPanel'
import { SourceCodeDialog } from './components/SourceCodeDialog'
import { ConfirmDialog } from './components/ConfirmDialog'
import { openWorkflowFromYaml, saveWorkflowToFile, getVscode, type OpenResult } from './lib/fileHandling'
import { serializeWorkflow, mergeWorkflowIntoYaml } from './lib/serializeWorkflow'
import { parseTriggers, triggersToOn } from './lib/triggerUtils'
import { validateWorkflowYaml, type LintError } from '@/lib/workflowValidation'
import {
  workflowToFlowNodesEdges,
  type AddJobNodeData,
  type JobNodeData,
  type TriggerNodeData,
} from './lib/workflowToFlow'
import type { Workflow } from '@/types/workflow'

type FlowNode = Node<JobNodeData | TriggerNodeData | AddJobNodeData>

const nodeTypes = { job: JobNode, trigger: TriggerNode, addJob: AddJobNode }

const MAX_UNDO_STEPS = 50

const sampleWorkflow: Workflow = {
  name: 'Sample',
  on: { push: { branches: ['main'] } },
  jobs: {
    build: {
      'runs-on': 'ubuntu-latest',
      steps: [{ run: 'echo build' }],
    },
    test: {
      needs: 'build',
      'runs-on': 'ubuntu-latest',
      steps: [{ run: 'echo test' }],
    },
  },
}

function AppInner() {
  const [, setTheme] = useState<'light' | 'dark'>('dark')
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [originalYaml, setOriginalYaml] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [selectedTrigger, setSelectedTrigger] = useState<boolean>(false)
  const [showWorkflowProperties, setShowWorkflowProperties] = useState<boolean>(false)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [dismissedWorkflow, setDismissedWorkflow] = useState<Workflow | null>(null)
  const [showSourceDialog, setShowSourceDialog] = useState(false)
  const [isEditingWorkflowName, setIsEditingWorkflowName] = useState(false)
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null)
  const [deleteJobMessage, setDeleteJobMessage] = useState<string>('')
  const [currentFilename, setCurrentFilename] = useState<string>('workflow.yml')
  const undoStackRef = useRef<Workflow[]>([])
  const workflowNameInputRef = useRef<HTMLInputElement>(null)
  const isUpdatingWorkflowRef = useRef(false)

  // Listen for VSCode theme changes and get icon URI
  useEffect(() => {
    const handleThemeChange = (event: CustomEvent<{ theme: 'light' | 'dark' }>) => {
      const newTheme = event.detail.theme
      setTheme(newTheme)
      const root = document.documentElement
      if (newTheme === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }

    window.addEventListener('vscode-themeChanged', handleThemeChange as EventListener)

    // Request initial theme
    const vscodeApi = getVscode()
    if (vscodeApi && vscodeApi.postMessage) {
      vscodeApi.postMessage({ command: 'getTheme' })
    } else {
      console.error('VSCode API not available')
    }

    return () => {
      window.removeEventListener('vscode-themeChanged', handleThemeChange as EventListener)
    }
  }, [])

  const hasNotifiedReadyRef = useRef(false)

  // Listen for file load events from VSCode
  useEffect(() => {
    const handleLoadFile = (event: CustomEvent<{ content: string; filename: string }>) => {
      const { content, filename } = event.detail
      const openResult: OpenResult = openWorkflowFromYaml(content)
      const { workflow: w, errors } = openResult
      undoStackRef.current = []
      setIsEditingWorkflowName(false)
      isUpdatingWorkflowRef.current = true
      setWorkflow(w)
      setOriginalYaml(content)
      setParseErrors(errors)
      setCurrentFilename(filename || 'workflow.yml')
      if (selectedJobId && w.jobs[selectedJobId]) {
        // Keep selection
      } else {
        setSelectedJobId(null)
      }
      setTimeout(() => {
        isUpdatingWorkflowRef.current = false
      }, 100)
    }

    window.addEventListener('vscode-loadFile', handleLoadFile as EventListener)
    if (!hasNotifiedReadyRef.current) {
      hasNotifiedReadyRef.current = true
      getVscode()?.postMessage?.({ command: 'ready' })
    }
    return () => {
      window.removeEventListener('vscode-loadFile', handleLoadFile as EventListener)
    }
  }, [selectedJobId])

  const pushUndoState = useCallback((w: Workflow | null) => {
    if (!w) return
    const stack = undoStackRef.current
    stack.push(JSON.parse(JSON.stringify(w)) as Workflow)
    if (stack.length > MAX_UNDO_STEPS) stack.shift()
  }, [])

  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current
    if (stack.length === 0) return
    const prev = stack.pop()
    if (!prev) return
    isUpdatingWorkflowRef.current = true
    setWorkflow(prev)
    setSelectedJobId(null)
    setSelectedTrigger(false)
    setTimeout(() => {
      isUpdatingWorkflowRef.current = false
    }, 100)
  }, [])

  // Compute nodes/edges from workflow on every render so trigger node always reflects current config (branches, tags, etc.)
  const w = workflow ?? { name: '', on: {}, jobs: {} }
  const { nodes: baseNodes, edges } = workflowToFlowNodesEdges(w)

  // Derive lint errors from workflow during render (no effect needed)
  const computedLintErrors = useMemo<LintError[]>(() => {
    if (!workflow) return []
    const hasJobs = workflow.jobs && Object.keys(workflow.jobs).length > 0
    const hasTriggers =
      workflow.on &&
      (typeof workflow.on === 'string' ||
        (Array.isArray(workflow.on) && workflow.on.length > 0) ||
        (typeof workflow.on === 'object' && Object.keys(workflow.on).length > 0))
    // Skip validation for an entirely empty workflow so that opening a brand-new
    // (empty) file shows the onboarding UI without noisy validation errors.
    if (!hasJobs && !hasTriggers) return []
    return validateWorkflowYaml(serializeWorkflow(workflow), currentFilename)
  }, [workflow, currentFilename])

  // Dismissed state: tracks which workflow object the user dismissed errors for.
  // As soon as the workflow changes (new reference), errors reappear automatically.
  const lintErrors = dismissedWorkflow === workflow ? [] : computedLintErrors

  const handleRequestDeleteJob = useCallback(
    (jobId: string) => {
      if (!workflow?.jobs[jobId]) return
      const jobName = workflow.jobs[jobId].name || jobId
      const message = `Are you sure you want to delete the job "${jobName}"? This cannot be undone.`
      setDeleteJobMessage(message)
      setDeleteJobId(jobId)
    },
    [workflow]
  )

  const handleConfirmDeleteJob = useCallback(() => {
    if (!deleteJobId || !workflow?.jobs[deleteJobId]) {
      setDeleteJobId(null)
      return
    }
    pushUndoState(workflow)
    const nextJobs = { ...workflow.jobs }
    delete nextJobs[deleteJobId]
    for (const id of Object.keys(nextJobs)) {
      const job = nextJobs[id]
      if (job.needs) {
        const needs = Array.isArray(job.needs) ? job.needs : [job.needs]
        const filtered = needs.filter((n) => n !== deleteJobId)
        if (filtered.length !== needs.length) {
          nextJobs[id] = {
            ...job,
            needs: filtered.length === 0 ? undefined : filtered.length === 1 ? filtered[0] : filtered,
          }
        }
      }
    }
    isUpdatingWorkflowRef.current = true
    setWorkflow({ ...workflow, jobs: nextJobs })
    setSelectedJobId(null)
    setDeleteJobId(null)
    setTimeout(() => {
      isUpdatingWorkflowRef.current = false
    }, 100)
  }, [deleteJobId, workflow, pushUndoState])

  const handleCancelDeleteJob = useCallback(() => {
    setDeleteJobId(null)
    setDeleteJobMessage('')
  }, [])

  // Derive effective selection so we don't show a deleted job as selected (avoids setState in effect)
  const effectiveSelectedJobId =
    selectedJobId && workflow?.jobs[selectedJobId] ? selectedJobId : null

  const nodes = useMemo(() => {
    return baseNodes.map((node) => {
      const selected =
        node.id === '__add_job__'
          ? false
          : node.id.startsWith('__trigger__')
            ? selectedTrigger
            : effectiveSelectedJobId === node.id
      if (node.type === 'job' && node.data && 'jobId' in node.data) {
        return { ...node, selected }
      }
      return { ...node, selected }
    })
  }, [baseNodes, effectiveSelectedJobId, selectedTrigger])

  const onSelectionChange: OnSelectionChangeFunc = useCallback(({ nodes: selectedNodes }) => {
    // Ignore selection changes during workflow updates
    if (isUpdatingWorkflowRef.current) {
      return
    }
    const addJobNode = selectedNodes.find((n) => n.id === '__add_job__')
    if (addJobNode) {
      setSelectedJobId(null)
      setSelectedTrigger(false)
      return
    }
    const triggerNode = selectedNodes.find((n) => n.type === 'trigger')
    const jobNode = selectedNodes.find((n) => n.type === 'job')

    if (triggerNode) {
      setSelectedTrigger(true)
      setSelectedJobId(null)
    } else if (jobNode) {
      const jobId = (jobNode.data as { jobId: string }).jobId
      setSelectedJobId(jobId)
      setSelectedTrigger(false)
    } else if (selectedNodes.length === 0) {
      // Only clear if user explicitly deselected (clicked on background)
      setSelectedJobId(null)
      setSelectedTrigger(false)
    }
  }, [])

  const handleSave = useCallback(() => {
    if (!workflow) return
    const contentToSave =
      originalYaml != null ? mergeWorkflowIntoYaml(originalYaml, workflow) : serializeWorkflow(workflow)
    saveWorkflowToFile(workflow, currentFilename, contentToSave)
    setOriginalYaml(contentToSave)
  }, [workflow, originalYaml, currentFilename])

  const generateUniqueJobId = useCallback((existingIds: string[]): string => {
    let counter = 1
    let jobId = `job-${counter}`
    while (existingIds.includes(jobId)) {
      counter++
      jobId = `job-${counter}`
    }
    return jobId
  }, [])

  const handleAddTrigger = useCallback(() => {
    if (!workflow) {
      const newWorkflow: Workflow = {
        name: 'Untitled Workflow',
        on: { push: { branches: ['main'] } },
        jobs: {},
      }
      isUpdatingWorkflowRef.current = true
      setWorkflow(newWorkflow)
      setSelectedTrigger(true)
      setSelectedJobId(null)
      setTimeout(() => {
        isUpdatingWorkflowRef.current = false
      }, 100)
      return
    }
    pushUndoState(workflow)
    const triggers = parseTriggers(workflow.on)
    const newTriggers = [...triggers, { event: 'push', config: {} }]
    const newOn = triggersToOn(newTriggers)
    isUpdatingWorkflowRef.current = true
    setWorkflow({ ...workflow, on: newOn })
    setSelectedTrigger(true)
    setSelectedJobId(null)
    setTimeout(() => {
      isUpdatingWorkflowRef.current = false
    }, 100)
  }, [workflow, pushUndoState])

  const handleAddJob = useCallback(
    (needs?: string[]) => {
      if (!workflow) {
        const newWorkflow: Workflow = {
          name: 'Untitled Workflow',
          on: { push: { branches: ['main'] } },
          jobs: {},
        }
        const jobId = generateUniqueJobId([])
        newWorkflow.jobs[jobId] = {
          'runs-on': 'ubuntu-latest',
          steps: [{ run: 'echo "Hello, World!"' }],
        }
        setWorkflow(newWorkflow)
        setSelectedJobId(jobId)
        return
      }

      pushUndoState(workflow)
      const triggers = parseTriggers(workflow.on)
      const needsTrigger = triggers.length === 0
      const updatedOn = needsTrigger ? { push: { branches: ['main'] } } : workflow.on

      const existingIds = Object.keys(workflow.jobs)
      const jobId = generateUniqueJobId(existingIds)
      const newJob: Workflow['jobs'][string] = {
        'runs-on': 'ubuntu-latest',
        steps: [{ run: 'echo "Hello, World!"' }],
      }
      if (needs && needs.length > 0) {
        newJob.needs = needs.length === 1 ? needs[0] : needs
      }

      isUpdatingWorkflowRef.current = true
      setWorkflow({
        ...workflow,
        on: updatedOn,
        jobs: {
          ...workflow.jobs,
          [jobId]: newJob,
        },
      })
      setSelectedJobId(jobId)
      setTimeout(() => {
        isUpdatingWorkflowRef.current = false
      }, 100)
    },
    [workflow, generateUniqueJobId, pushUndoState]
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: FlowNode) => {
      if (node.id === '__add_job__') {
        const data = node.data as AddJobNodeData
        if (data?.needs?.length) {
          handleAddJob(data.needs)
        }
      }
    },
    [handleAddJob]
  )

  const hasJobs = nodes.some((n) => n.type === 'job')
  const hasTriggers = workflow && workflow.on &&
    (typeof workflow.on === 'string' ||
     (Array.isArray(workflow.on) && workflow.on.length > 0) ||
     (typeof workflow.on === 'object' && Object.keys(workflow.on).length > 0))
  const hasContent = hasJobs || hasTriggers

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (showSourceDialog) {
        if (e.key === 'Escape') setShowSourceDialog(false)
        return
      }
      if (e.key === 'Escape') {
        setSelectedTrigger(false)
        setSelectedJobId(null)
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        handleUndo()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (workflow && hasJobs) handleSave()
      }
    },
    [showSourceDialog, workflow, hasJobs, handleSave, handleUndo]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Focus workflow name input when editing starts
  useEffect(() => {
    if (isEditingWorkflowName && workflowNameInputRef.current) {
      workflowNameInputRef.current.focus()
      workflowNameInputRef.current.select()
    }
  }, [isEditingWorkflowName])

  const handleWorkflowNameChange = useCallback(
    (value: string) => {
      if (!workflow) return
      pushUndoState(workflow)
      isUpdatingWorkflowRef.current = true
      setWorkflow({ ...workflow, name: value || undefined })
      setTimeout(() => {
        isUpdatingWorkflowRef.current = false
      }, 100)
    },
    [workflow, pushUndoState]
  )

  const handleWorkflowNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.currentTarget.blur()
        setIsEditingWorkflowName(false)
      } else if (e.key === 'Escape') {
        setIsEditingWorkflowName(false)
      }
    },
    []
  )

  // Listen for save request from VSCode (e.g. Ctrl+S when workflow editor is focused)
  useEffect(() => {
    const onSaveRequest = () => {
      if (workflow && hasJobs) handleSave()
    }
    window.addEventListener('vscode-saveRequest', onSaveRequest)
    return () => window.removeEventListener('vscode-saveRequest', onSaveRequest)
  }, [workflow, hasJobs, handleSave])

  // Listen for undo request from VSCode (e.g. Ctrl+Z when workflow editor is focused)
  useEffect(() => {
    window.addEventListener('vscode-undoRequest', handleUndo)
    return () => window.removeEventListener('vscode-undoRequest', handleUndo)
  }, [handleUndo])

  // Respond to extension request for dirty state (before reload-on-focus)
  useEffect(() => {
    const onRequestDirtyState = () => {
      const currentYaml =
        workflow != null
          ? originalYaml != null
            ? mergeWorkflowIntoYaml(originalYaml, workflow)
            : serializeWorkflow(workflow)
          : ''
      const isDirty =
        workflow != null && (originalYaml === null || currentYaml !== originalYaml)
      getVscode()?.postMessage?.({ command: 'dirtyState', isDirty })
    }
    window.addEventListener('vscode-requestDirtyState', onRequestDirtyState)
    return () => window.removeEventListener('vscode-requestDirtyState', onRequestDirtyState)
  }, [workflow, originalYaml])

  const sourceDialogYaml = useMemo(() => {
    if (!workflow) return ''
    return originalYaml != null ? mergeWorkflowIntoYaml(originalYaml, workflow) : serializeWorkflow(workflow)
  }, [workflow, originalYaml])

  return (
    <div className="h-full w-full flex flex-col bg-slate-100 dark:bg-slate-900 pr-4 box-border max-w-full overflow-x-hidden">
      {showSourceDialog && workflow && (
        <SourceCodeDialog
          key={sourceDialogYaml}
          initialYaml={sourceDialogYaml}
          filename={currentFilename}
          onClose={() => setShowSourceDialog(false)}
          onSave={(w, errors, savedYaml) => {
            pushUndoState(workflow)
            setIsEditingWorkflowName(false)
            isUpdatingWorkflowRef.current = true
            setWorkflow(w)
            setOriginalYaml(savedYaml)
            setParseErrors(errors)
            saveWorkflowToFile(w, currentFilename, savedYaml)
            setTimeout(() => {
              isUpdatingWorkflowRef.current = false
            }, 100)
          }}
        />
      )}
      {deleteJobId && (
        <ConfirmDialog
          message={deleteJobMessage}
          onConfirm={handleConfirmDeleteJob}
          onCancel={handleCancelDeleteJob}
        />
      )}
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 shadow-sm text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {workflow ? (
            isEditingWorkflowName ? (
              <input
                ref={workflowNameInputRef}
                type="text"
                value={workflow.name || ''}
                onChange={(e) => handleWorkflowNameChange(e.target.value)}
                onBlur={() => setIsEditingWorkflowName(false)}
                onKeyDown={handleWorkflowNameKeyDown}
                className="text-xs font-semibold text-slate-800 dark:text-slate-200 bg-transparent border-b-2 border-slate-400 dark:border-slate-600 focus:border-slate-600 dark:focus:border-slate-400 focus:outline-none px-1 -mx-1 min-w-0 flex-1 max-w-md"
                placeholder="Untitled Workflow"
              />
            ) : (
              <h1
                className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-text hover:text-slate-600 dark:hover:text-slate-300 transition-colors min-w-0 flex-1"
                onClick={() => setIsEditingWorkflowName(true)}
                title="Click to edit workflow name"
              >
                {workflow.name || 'Untitled Workflow'}
              </h1>
            )
          ) : (
            <h1 className="text-xs font-semibold text-slate-400 dark:text-slate-500">No workflow loaded</h1>
          )}
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Editor">
          <button
            type="button"
            onClick={handleAddTrigger}
            className="rounded border border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50"
          >
            + Add Trigger
          </button>
          <button
            type="button"
            onClick={() => handleAddJob()}
            className="rounded border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
          >
            + Add Job
          </button>
        </div>
        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
        <div className="flex items-center gap-2" role="group" aria-label="File">
          <button
            type="button"
            onClick={() => setShowSourceDialog(true)}
            disabled={!workflow}
            className="rounded p-1.5 disabled:opacity-50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            title="View source"
            aria-label="View source"
          >
            <HiCode className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (workflow) pushUndoState(workflow)
              setIsEditingWorkflowName(false)
              setOriginalYaml(null)
              setWorkflow(workflow ? null : sampleWorkflow)
            }}
            className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            title={workflow ? 'Clear' : 'Load sample'}
            aria-label={workflow ? 'Clear' : 'Load sample'}
          >
            {workflow ? <FaBroom className="w-4 h-4" /> : <HiFolderOpen className="w-4 h-4" />}
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowWorkflowProperties(true)}
            disabled={!workflow}
            className={`rounded p-1.5 disabled:opacity-50 ${
              showWorkflowProperties
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            title="Edit workflow name, run name, and environment variables"
            aria-label="Workflow config"
          >
            <HiCog className="w-4 h-4" />
          </button>
          <a
            href="https://github.com/timoa/workflow-editor/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            title="Report a bug or request a feature"
            aria-label="GitHub Issues"
          >
            <FaBug className="w-4 h-4" />
          </a>
        </div>
      </header>
      {(parseErrors.length > 0 || lintErrors.length > 0) && (
        <div
          role="alert"
          className="flex flex-col gap-2 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-200"
        >
          <div className="flex items-center justify-between">
            <span>
              <strong>Validation:</strong>{' '}
              {parseErrors.length > 0 && `${parseErrors.length} parse error${parseErrors.length !== 1 ? 's' : ''}`}
              {parseErrors.length > 0 && lintErrors.length > 0 && ' • '}
              {lintErrors.length > 0 && `${lintErrors.length} lint error${lintErrors.length !== 1 ? 's' : ''}`}
            </span>
            <button
              type="button"
              onClick={() => {
                setParseErrors([])
                setDismissedWorkflow(workflow)
              }}
              className="shrink-0 rounded p-1 hover:bg-amber-100 dark:hover:bg-amber-800/50"
              aria-label="Dismiss errors"
            >
              ×
            </button>
          </div>
          {parseErrors.length > 0 && (
            <div className="text-xs">
              <strong>Parse errors:</strong> {parseErrors.join(' • ')}
            </div>
          )}
          {lintErrors.length > 0 && (
            <div className="space-y-1 text-xs">
              <strong>Lint errors:</strong>
              <ul className="ml-4 list-disc space-y-0.5">
                {lintErrors.map((error, idx) => (
                  <li key={`${error.path ?? ''}-${error.message}-${idx}`}>
                    <span className={error.severity === 'error' ? 'font-medium' : ''}>
                      {error.path && <code className="text-xs">{error.path}:</code>} {error.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <main className="flex-1 overflow-hidden flex" role="main" aria-label="Workflow diagram">
        <div className="flex-1 relative min-w-0">
          {hasContent ? (
            <ReactFlow
              key={workflow ? `flow-on-${JSON.stringify(workflow.on)}` : 'flow'}
              nodes={nodes}
              edges={edges}
              onSelectionChange={onSelectionChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ maxZoom: 0.85 }}
              className="bg-slate-50 dark:bg-slate-900"
            >
              <Background />
              <Controls />
              {/* <MiniMap /> */}
            </ReactFlow>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 gap-4">
              <p className="text-slate-500 dark:text-slate-400">No jobs in workflow.</p>
              <button
                type="button"
                onClick={() => handleAddJob()}
                className="rounded border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
              >
                + Add Your First Job
              </button>
            </div>
          )}
        </div>
        {showWorkflowProperties && workflow && (
          <WorkflowPropertyPanel
            workflow={workflow}
            onWorkflowChange={(w) => {
              pushUndoState(workflow)
              isUpdatingWorkflowRef.current = true
              setWorkflow(w)
              setTimeout(() => {
                isUpdatingWorkflowRef.current = false
              }, 100)
            }}
            onClose={() => setShowWorkflowProperties(false)}
          />
        )}
        {selectedTrigger && workflow && !showWorkflowProperties && (
          <TriggerPropertyPanel
            key={JSON.stringify(workflow.on ?? {})}
            workflow={workflow}
            onWorkflowChange={(w) => {
              pushUndoState(workflow)
              isUpdatingWorkflowRef.current = true
              setWorkflow(w)
              setTimeout(() => {
                isUpdatingWorkflowRef.current = false
              }, 100)
            }}
            onClose={() => setSelectedTrigger(false)}
          />
        )}
        {effectiveSelectedJobId && workflow && !selectedTrigger && !showWorkflowProperties && (
          <JobPropertyPanel
            workflow={workflow}
            jobId={effectiveSelectedJobId}
            onWorkflowChange={(w) => {
              pushUndoState(workflow)
              isUpdatingWorkflowRef.current = true
              setWorkflow(w)
              setTimeout(() => {
                isUpdatingWorkflowRef.current = false
              }, 100)
            }}
            onClose={() => setSelectedJobId(null)}
            onDeleteJob={handleRequestDeleteJob}
          />
        )}
      </main>
    </div>
  )
}

function App() {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  )
}

export default App
