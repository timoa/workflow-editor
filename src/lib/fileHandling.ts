import { parseWorkflow } from './parseWorkflow'
import { serializeWorkflow } from './serializeWorkflow'
import type { Workflow } from '@/types/workflow'

export interface OpenResult {
  workflow: Workflow
  errors: string[]
}

export function openWorkflowFromYaml(yamlContent: string): OpenResult {
  const { workflow, errors } = parseWorkflow(yamlContent)
  return { workflow, errors }
}

export function saveWorkflowToFile(workflow: Workflow, filename: string = 'workflow.yml'): void {
  const yaml = serializeWorkflow(workflow)
  const blob = new Blob([yaml], { type: 'application/x-yaml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function validateWorkflow(workflow: Workflow): string[] {
  const yaml = serializeWorkflow(workflow)
  const { errors } = parseWorkflow(yaml)
  return errors
}
