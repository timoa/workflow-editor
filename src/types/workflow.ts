/**
 * TypeScript types for GitHub Actions workflow model.
 * Aligned with https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions
 */

export interface WorkflowStep {
  id?: string
  name?: string
  uses?: string
  run?: string
  with?: Record<string, unknown>
  env?: Record<string, string>
  shell?: string
  [key: string]: unknown
}

export interface WorkflowJob {
  name?: string
  'runs-on': string | string[]
  needs?: string | string[]
  permissions?: Record<string, string>
  env?: Record<string, string>
  steps: WorkflowStep[]
  container?: unknown
  services?: Record<string, unknown>
  if?: string
  [key: string]: unknown
}

export interface Workflow {
  name?: string
  'run-name'?: string
  on: Record<string, unknown> | string | (string | Record<string, unknown>)[]
  env?: Record<string, string>
  jobs: Record<string, WorkflowJob>
  [key: string]: unknown
}
