import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  type Node,
  type OnSelectionChangeFunc,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AddJobNode } from '@/components/AddJobNode'
import { JobNode } from '@/components/JobNode'
import { JobPropertyPanel } from '@/components/JobPropertyPanel'
import { TriggerNode } from '@/components/TriggerNode'
import { TriggerPropertyPanel } from '@/components/TriggerPropertyPanel'
import { WorkflowPropertyPanel } from '@/components/WorkflowPropertyPanel'
import { PasteYamlDialog } from '@/components/PasteYamlDialog'
import { SourceCodeDialog } from '@/components/SourceCodeDialog'
import { openWorkflowFromYaml, saveWorkflowToFile } from '@/lib/fileHandling'
import { serializeWorkflow } from '@/lib/serializeWorkflow'
import { parseTriggers, triggersToOn } from '@/lib/triggerUtils'
import { lintWorkflow, type LintError } from '@/lib/workflowLinter'
import {
  workflowToFlowNodesEdges,
  type AddJobNodeData,
  type JobNodeData,
  type TriggerNodeData,
} from '@/lib/workflowToFlow'
import type { Workflow } from '@/types/workflow'

type FlowNode = Node<JobNodeData | TriggerNodeData | AddJobNodeData>

const nodeTypes = { job: JobNode, trigger: TriggerNode, addJob: AddJobNode }

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
  const [workflow, setWorkflow] = useState<Workflow | null>(sampleWorkflow)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [selectedTrigger, setSelectedTrigger] = useState<boolean>(false)
  const [showWorkflowProperties, setShowWorkflowProperties] = useState<boolean>(false)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [lintErrors, setLintErrors] = useState<LintError[]>([])
  const [showPasteDialog, setShowPasteDialog] = useState(false)
  const [showSourceDialog, setShowSourceDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isUpdatingWorkflowRef = useRef(false)

  const { nodes: baseNodes, edges } = useMemo(() => {
    const w = workflow ?? { name: '', on: {}, jobs: {} }
    return workflowToFlowNodesEdges(w)
  }, [workflow])

  // Lint workflow whenever it changes
  useEffect(() => {
    if (workflow) {
      const errors = lintWorkflow(workflow)
      setLintErrors(errors)
    } else {
      setLintErrors([])
    }
  }, [workflow])

  const handleRequestDeleteJob = useCallback(
    (jobId: string) => {
      if (!workflow?.jobs[jobId]) return
      const jobName = workflow.jobs[jobId].name || jobId
      const message = `Are you sure you want to delete the job "${jobName}"? This cannot be undone.`
      if (!window.confirm(message)) return
      const nextJobs = { ...workflow.jobs }
      delete nextJobs[jobId]
      for (const id of Object.keys(nextJobs)) {
        const job = nextJobs[id]
        if (job.needs) {
          const needs = Array.isArray(job.needs) ? job.needs : [job.needs]
          const filtered = needs.filter((n) => n !== jobId)
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
      setTimeout(() => {
        isUpdatingWorkflowRef.current = false
      }, 100)
    },
    [workflow]
  )

  const nodes = useMemo(() => {
    return baseNodes.map((node) => {
      const selected =
        node.id === '__add_job__'
          ? false
          : node.id.startsWith('__trigger__')
            ? selectedTrigger
            : selectedJobId === node.id
      if (node.type === 'job' && node.data && 'jobId' in node.data) {
        return { ...node, selected }
      }
      return { ...node, selected }
    })
  }, [baseNodes, selectedJobId, selectedTrigger])

  // Preserve selection when workflow updates
  useEffect(() => {
    if (selectedJobId && workflow && !workflow.jobs[selectedJobId]) {
      // Job was deleted, clear selection
      setSelectedJobId(null)
    }
  }, [workflow, selectedJobId])

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

  const handleOpenFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const { workflow: w, errors } = openWorkflowFromYaml(text)
      isUpdatingWorkflowRef.current = true
      setWorkflow(w)
      setParseErrors(errors)
      // Preserve selection if the job still exists
      if (selectedJobId && w.jobs[selectedJobId]) {
        // Keep selection - it will be preserved by nodesSelection
      } else {
        setSelectedJobId(null)
      }
      // Reset flag after a brief delay to allow React Flow to update
      setTimeout(() => {
        isUpdatingWorkflowRef.current = false
      }, 100)
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [selectedJobId])

  const handlePasteLoad = useCallback((yaml: string) => {
    const { workflow: w, errors } = openWorkflowFromYaml(yaml)
    isUpdatingWorkflowRef.current = true
    setWorkflow(w)
    setParseErrors(errors)
    // Preserve selection if the job still exists
    if (selectedJobId && w.jobs[selectedJobId]) {
      // Keep selection - it will be preserved by nodesSelection
    } else {
      setSelectedJobId(null)
    }
    // Reset flag after a brief delay to allow React Flow to update
    setTimeout(() => {
      isUpdatingWorkflowRef.current = false
    }, 100)
  }, [selectedJobId])

  const handleSave = useCallback(() => {
    if (!workflow) return
    const name = workflow.name?.replace(/\s+/g, '-').toLowerCase() || 'workflow'
    saveWorkflowToFile(workflow, `${name}.yml`)
  }, [workflow])

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
  }, [workflow])

  const handleAddJob = useCallback(
    (needs?: string[]) => {
      if (!workflow) {
        // Create a new workflow if none exists
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
    [workflow, generateUniqueJobId]
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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (showPasteDialog) {
        if (e.key === 'Escape') setShowPasteDialog(false)
        return
      }
      if (showSourceDialog) {
        if (e.key === 'Escape') setShowSourceDialog(false)
        return
      }
      if (e.key === 'Escape') {
        setSelectedTrigger(false)
        setSelectedJobId(null)
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault()
        fileInputRef.current?.click()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (workflow && hasJobs) handleSave()
      }
    },
    [showPasteDialog, showSourceDialog, workflow, hasJobs, handleSave]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="h-full w-full flex flex-col bg-slate-100">
      <input
        ref={fileInputRef}
        type="file"
        accept=".yml,.yaml"
        onChange={handleOpenFile}
        className="hidden"
        aria-label="Open workflow file"
      />
      {showPasteDialog && (
        <PasteYamlDialog
          onClose={() => setShowPasteDialog(false)}
          onLoad={handlePasteLoad}
        />
      )}
      {showSourceDialog && workflow && (
        <SourceCodeDialog
          initialYaml={serializeWorkflow(workflow)}
          onClose={() => setShowSourceDialog(false)}
          onSave={(w, errors) => {
            isUpdatingWorkflowRef.current = true
            setWorkflow(w)
            setParseErrors(errors)
            setTimeout(() => {
              isUpdatingWorkflowRef.current = false
            }, 100)
          }}
        />
      )}
      <header className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-4 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-800">GitHub Actions GUI</h1>
          {workflow && (
            <span className="text-sm text-slate-500">
              {workflow.name || 'Untitled Workflow'}
            </span>
          )}
        </div>
        <div className="h-6 w-px bg-slate-200" aria-hidden />
        <div className="flex items-center gap-2" role="group" aria-label="File">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
          >
            Open file
          </button>
          <button
            type="button"
            onClick={() => setShowPasteDialog(true)}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
          >
            Paste YAML
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!workflow || !hasJobs}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setWorkflow(workflow ? null : sampleWorkflow)}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
          >
            {workflow ? 'Clear' : 'Load sample'}
          </button>
          <button
            type="button"
            onClick={() => setShowSourceDialog(true)}
            disabled={!workflow}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            View source
          </button>
        </div>
        <div className="h-6 w-px bg-slate-200" aria-hidden />
        <div className="flex items-center gap-2" role="group" aria-label="Editor">
          <button
            type="button"
            onClick={() => setShowWorkflowProperties(true)}
            disabled={!workflow}
            className={`rounded border px-2 py-1 text-sm font-medium disabled:opacity-50 ${
              showWorkflowProperties
                ? 'border-slate-500 bg-slate-100 text-slate-800 ring-1 ring-slate-300'
                : 'border-slate-400 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-500'
            }`}
            title="Edit workflow name, run name, and environment variables"
          >
            Workflow config
          </button>
          <button
            type="button"
            onClick={handleAddTrigger}
            className="rounded border border-purple-300 bg-purple-50 px-2 py-1 text-sm font-medium text-purple-700 hover:bg-purple-100"
          >
            + Add Trigger
          </button>
          <button
            type="button"
            onClick={() => handleAddJob()}
            className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            + Add Job
          </button>
        </div>
      </header>
      {(parseErrors.length > 0 || lintErrors.length > 0) && (
        <div
          role="alert"
          className="flex flex-col gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
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
                setLintErrors([])
              }}
              className="shrink-0 rounded p-1 hover:bg-amber-100"
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
                  <li key={idx}>
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
        <div className="flex-1 relative">
          {hasJobs ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onSelectionChange={onSelectionChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              className="bg-slate-50"
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 gap-4">
              <p className="text-slate-500">No jobs in workflow.</p>
              <button
                type="button"
                onClick={() => handleAddJob()}
                className="rounded border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
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
              isUpdatingWorkflowRef.current = true
              setWorkflow(w)
              // Reset flag after a brief delay to allow React Flow to update
              setTimeout(() => {
                isUpdatingWorkflowRef.current = false
              }, 100)
            }}
            onClose={() => setShowWorkflowProperties(false)}
          />
        )}
        {selectedTrigger && workflow && !showWorkflowProperties && (
          <TriggerPropertyPanel
            workflow={workflow}
            onWorkflowChange={(w) => {
              isUpdatingWorkflowRef.current = true
              setWorkflow(w)
              // Reset flag after a brief delay to allow React Flow to update
              setTimeout(() => {
                isUpdatingWorkflowRef.current = false
              }, 100)
            }}
            onClose={() => setSelectedTrigger(false)}
          />
        )}
        {selectedJobId && workflow && !selectedTrigger && !showWorkflowProperties && (
          <JobPropertyPanel
            workflow={workflow}
            jobId={selectedJobId}
            onWorkflowChange={(w) => {
              isUpdatingWorkflowRef.current = true
              setWorkflow(w)
              // Reset flag after a brief delay to allow React Flow to update
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
