import type { Node, Edge } from '@xyflow/react'
import type { Workflow } from '@/types/workflow'

const NODE_WIDTH = 200
const NODE_HEIGHT = 80
const HORIZONTAL_GAP = 80
const VERTICAL_GAP = 60

export type JobNodeData = {
  jobId: string
  label: string
  runsOn: string
  stepCount: number
}

/**
 * Build React Flow nodes and edges from workflow model.
 * Layout: jobs flow left-to-right by dependency level (column 0 = no deps, column 1 = needs column 0, etc.);
 * within each column nodes are stacked vertically.
 */
export function workflowToFlowNodesEdges(workflow: Workflow): {
  nodes: Node<JobNodeData>[]
  edges: Edge[]
} {
  const jobIds = Object.keys(workflow.jobs)
  if (jobIds.length === 0) {
    return { nodes: [], edges: [] }
  }

  const edges: Edge[] = []
  const needsMap = new Map<string, string[]>()
  for (const id of jobIds) {
    const job = workflow.jobs[id]
    const needList: string[] = job.needs
      ? Array.isArray(job.needs) ? job.needs : [job.needs]
      : []
    needsMap.set(id, needList)
    for (const n of needList) {
      edges.push({
        id: `${n}-${id}`,
        source: n,
        target: id,
      })
    }
  }

  const columns: string[][] = []
  const placed = new Set<string>()
  let remaining = [...jobIds]
  while (remaining.length > 0) {
    const column: string[] = []
    for (const id of remaining) {
      const needs = needsMap.get(id) ?? []
      if (needs.every((n) => placed.has(n))) {
        column.push(id)
      }
    }
    if (column.length === 0) {
      column.push(remaining[0])
    }
    for (const id of column) {
      placed.add(id)
    }
    columns.push(column)
    remaining = remaining.filter((id) => !placed.has(id))
  }

  const nodes: Node<JobNodeData>[] = []
  for (let colIndex = 0; colIndex < columns.length; colIndex++) {
    const column = columns[colIndex]
    const x = colIndex * (NODE_WIDTH + HORIZONTAL_GAP)
    for (let rowIndex = 0; rowIndex < column.length; rowIndex++) {
      const jobId = column[rowIndex]
      const job = workflow.jobs[jobId]
      const y = rowIndex * (NODE_HEIGHT + VERTICAL_GAP)
      const runsOn = Array.isArray(job['runs-on'])
        ? job['runs-on'].join(', ')
        : String(job['runs-on'] ?? '')
      const stepCount = job.steps?.length ?? 0
      nodes.push({
        id: jobId,
        type: 'job',
        position: { x, y },
        data: {
          jobId,
          label: job.name ?? jobId,
          runsOn,
          stepCount,
        },
      })
    }
  }

  return { nodes, edges }
}
