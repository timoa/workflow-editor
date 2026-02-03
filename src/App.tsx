import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  type OnSelectionChangeFunc,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { JobNode } from '@/components/JobNode'
import { JobPropertyPanel } from '@/components/JobPropertyPanel'
import { PasteYamlDialog } from '@/components/PasteYamlDialog'
import { openWorkflowFromYaml, saveWorkflowToFile } from '@/lib/fileHandling'
import { workflowToFlowNodesEdges } from '@/lib/workflowToFlow'
import type { Workflow } from '@/types/workflow'

const nodeTypes = { job: JobNode }

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
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [showPasteDialog, setShowPasteDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { nodes, edges } = useMemo(() => {
    const w = workflow ?? { name: '', on: {}, jobs: {} }
    return workflowToFlowNodesEdges(w)
  }, [workflow])

  const onSelectionChange: OnSelectionChangeFunc = useCallback(({ nodes: selectedNodes }) => {
    const single = selectedNodes.find((n) => n.type === 'job')
    setSelectedJobId(single ? (single.data as { jobId: string }).jobId : null)
  }, [])

  const handleOpenFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const { workflow: w, errors } = openWorkflowFromYaml(text)
      setWorkflow(w)
      setParseErrors(errors)
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [])

  const handlePasteLoad = useCallback((yaml: string) => {
    const { workflow: w, errors } = openWorkflowFromYaml(yaml)
    setWorkflow(w)
    setParseErrors(errors)
  }, [])

  const handleSave = useCallback(() => {
    if (!workflow) return
    const name = workflow.name?.replace(/\s+/g, '-').toLowerCase() || 'workflow'
    saveWorkflowToFile(workflow, `${name}.yml`)
  }, [workflow])

  const hasJobs = nodes.length > 0

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (showPasteDialog) {
        if (e.key === 'Escape') setShowPasteDialog(false)
        return
      }
      if (e.key === 'Escape') {
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
    [showPasteDialog, workflow, hasJobs, handleSave]
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
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-800">GitHub Actions GUI</h1>
        {workflow?.name && (
          <span className="text-sm text-slate-500">{workflow.name}</span>
        )}
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
      </header>
      {parseErrors.length > 0 && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
        >
          <span><strong>Validation:</strong> {parseErrors.join(' ')}</span>
          <button
            type="button"
            onClick={() => setParseErrors([])}
            className="shrink-0 rounded p-1 hover:bg-amber-100"
            aria-label="Dismiss errors"
          >
            ×
          </button>
        </div>
      )}
      <main className="flex-1 overflow-hidden flex" role="main" aria-label="Workflow diagram">
        <div className="flex-1 relative">
          {hasJobs ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onSelectionChange={onSelectionChange}
              nodeTypes={nodeTypes}
              fitView
              className="bg-slate-50"
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
              <p className="text-slate-500">Open a workflow file or paste YAML to visualize jobs.</p>
            </div>
          )}
        </div>
        {selectedJobId && workflow && (
          <JobPropertyPanel
            workflow={workflow}
            jobId={selectedJobId}
            onWorkflowChange={setWorkflow}
            onClose={() => setSelectedJobId(null)}
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
