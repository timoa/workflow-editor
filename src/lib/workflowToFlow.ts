import type { Node, Edge } from '@xyflow/react'
import type { Workflow } from '@/types/workflow'
import type { ParsedTrigger } from './triggerUtils'
import { parseTriggers } from './triggerUtils'

const NODE_WIDTH = 200
const NODE_HEIGHT = 80
const TRIGGER_NODE_WIDTH = 240
const TRIGGER_NODE_HEIGHT = 100
const HORIZONTAL_GAP = 80
const VERTICAL_GAP = 60

export type JobNodeData = {
  jobId: string
  label: string
  runsOn: string
  stepCount: number
  hasMatrix?: boolean
  matrixCombinations?: number
}

export type TriggerNodeData = {
  triggers: ParsedTrigger[]
}

export type AddJobNodeData = {
  needs: string[]
}

/**
 * Build React Flow nodes and edges from workflow model.
 * Layout: trigger node first, then jobs flow left-to-right by dependency level (column 0 = no deps, column 1 = needs column 0, etc.);
 * within each column nodes are stacked vertically.
 */
export function workflowToFlowNodesEdges(workflow: Workflow): {
  nodes: Node<JobNodeData | TriggerNodeData | AddJobNodeData>[]
  edges: Edge[]
} {
  const jobIds = Object.keys(workflow.jobs)
  const triggers = parseTriggers(workflow.on)
  
  const nodes: Node<JobNodeData | TriggerNodeData | AddJobNodeData>[] = []
  const edges: Edge[] = []

  // One trigger node per trigger (or a single empty node if no triggers)
  if (triggers.length === 0) {
    const triggerNode: Node<TriggerNodeData> = {
      id: '__trigger__0',
      type: 'trigger',
      position: { x: 0, y: 0 },
      data: { triggers: [] },
    }
    nodes.push(triggerNode)
  } else {
    triggers.forEach((trigger, index) => {
      const triggerNode: Node<TriggerNodeData> = {
        id: `__trigger__${index}`,
        type: 'trigger',
        position: { x: 0, y: index * (TRIGGER_NODE_HEIGHT + VERTICAL_GAP) },
        data: { triggers: [trigger] },
      }
      nodes.push(triggerNode)
    })
  }

  if (jobIds.length === 0) {
    return { nodes, edges }
  }

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

  // Center trigger column vertically relative to first job column
  const firstColumnHeight = columns[0]?.length ?? 0
  const triggerCount = nodes.filter((n) => n.id.startsWith('__trigger__')).length
  const triggerColumnHeight = triggerCount * (TRIGGER_NODE_HEIGHT + VERTICAL_GAP) - VERTICAL_GAP
  const triggerY = firstColumnHeight > 0
    ? Math.max(0, (firstColumnHeight - 1) * (NODE_HEIGHT + VERTICAL_GAP) / 2 - triggerColumnHeight / 2)
    : 0
  
  nodes.forEach((node) => {
    if (node.id.startsWith('__trigger__')) {
      const idx = parseInt(node.id.replace('__trigger__', ''), 10)
      if (!Number.isNaN(idx)) {
        node.position.y = triggerY + idx * (TRIGGER_NODE_HEIGHT + VERTICAL_GAP)
      }
    }
  })

  // Position jobs starting after trigger node
  const jobStartX = TRIGGER_NODE_WIDTH + HORIZONTAL_GAP
  for (let colIndex = 0; colIndex < columns.length; colIndex++) {
    const column = columns[colIndex]
    const x = jobStartX + colIndex * (NODE_WIDTH + HORIZONTAL_GAP)
    for (let rowIndex = 0; rowIndex < column.length; rowIndex++) {
      const jobId = column[rowIndex]
      const job = workflow.jobs[jobId]
      const y = rowIndex * (NODE_HEIGHT + VERTICAL_GAP)
      const runsOn = Array.isArray(job['runs-on'])
        ? job['runs-on'].join(', ')
        : String(job['runs-on'] ?? '')
      const stepCount = job.steps?.length ?? 0
      const hasMatrix = !!job.strategy?.matrix && Object.keys(job.strategy.matrix).length > 0
      let matrixCombinations: number | undefined
      if (hasMatrix && job.strategy?.matrix) {
        matrixCombinations = Object.values(job.strategy.matrix).reduce(
          (acc, values) => acc * (Array.isArray(values) ? values.length : 1),
          1
        )
      }
      nodes.push({
        id: jobId,
        type: 'job',
        position: { x, y },
        data: {
          jobId,
          label: job.name ?? jobId,
          runsOn,
          stepCount,
          hasMatrix,
          matrixCombinations,
        },
      })
    }
  }

  // Add edges from each trigger node to all jobs in the first column
  if (columns.length > 0) {
    const triggerNodeIds = nodes.filter((n) => n.id.startsWith('__trigger__')).map((n) => n.id)
    for (const triggerId of triggerNodeIds) {
      for (const jobId of columns[0]) {
        edges.push({
          id: `${triggerId}-${jobId}`,
          source: triggerId,
          target: jobId,
        })
      }
    }
  }

  // Add "+" node at the end to create new jobs from the diagram
  const lastColumn = columns[columns.length - 1]
  if (lastColumn && lastColumn.length > 0) {
    const lastColX = jobStartX + (columns.length - 1) * (NODE_WIDTH + HORIZONTAL_GAP)
    const addJobX = lastColX + NODE_WIDTH + HORIZONTAL_GAP
    const lastColumnHeight = lastColumn.length
    const ADD_JOB_NODE_HEIGHT = 40 // h-10 = 40px
    // Align add-job node vertically with the job column (center of column = center of add button)
    const columnCenterY =
      lastColumnHeight > 0
        ? ((lastColumnHeight - 1) * (NODE_HEIGHT + VERTICAL_GAP)) / 2 + NODE_HEIGHT / 2
        : NODE_HEIGHT / 2
    const addJobY = columnCenterY - ADD_JOB_NODE_HEIGHT / 2
    const addJobNode: Node<AddJobNodeData> = {
      id: '__add_job__',
      type: 'addJob',
      position: { x: addJobX, y: addJobY },
      data: { needs: lastColumn },
    }
    nodes.push(addJobNode)
    for (const jobId of lastColumn) {
      edges.push({
        id: `${jobId}-__add_job__`,
        source: jobId,
        target: '__add_job__',
      })
    }
  }

  return { nodes, edges }
}
