import type { Workflow, WorkflowJob } from '@/types/workflow'
import { parseTriggers } from './triggerUtils'
import type { ParsedTrigger } from './triggerUtils'

export interface LintError {
  message: string
  path?: string // e.g., "jobs.build.steps[0]"
  severity: 'error' | 'warning'
}

/**
 * Valid GitHub Actions trigger event names
 * Reference: https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows
 */
const VALID_TRIGGER_EVENTS = new Set([
  'push',
  'pull_request',
  'pull_request_target',
  'workflow_dispatch',
  'workflow_call',
  'workflow_run',
  'repository_dispatch',
  'schedule',
  'create',
  'delete',
  'deployment',
  'deployment_status',
  'fork',
  'gollum',
  'issue_comment',
  'issues',
  'label',
  'milestone',
  'page_build',
  'project',
  'project_card',
  'project_column',
  'public',
  'pull_request_review',
  'pull_request_review_comment',
  'push',
  'registry_package',
  'release',
  'status',
  'watch',
])

/**
 * Valid pull_request types
 */
const VALID_PULL_REQUEST_TYPES = new Set([
  'assigned',
  'auto_merge_disabled',
  'auto_merge_enabled',
  'closed',
  'converted_to_draft',
  'edited',
  'labeled',
  'locked',
  'opened',
  'ready_for_review',
  'reopened',
  'review_requested',
  'review_request_removed',
  'synchronize',
  'unassigned',
  'unlabeled',
  'unlocked',
])

/**
 * Valid workflow_run activity types
 */
const VALID_WORKFLOW_RUN_ACTIVITIES = new Set(['completed', 'requested'])

/**
 * Valid runner labels
 */
const VALID_RUNNERS = new Set([
  'ubuntu-latest',
  'ubuntu-22.04',
  'ubuntu-20.04',
  'windows-latest',
  'windows-2022',
  'windows-2019',
  'macos-latest',
  'macos-14',
  'macos-13',
  'macos-12',
  'self-hosted',
])

/**
 * Validate cron expression format (basic check)
 */
function isValidCron(cron: string): boolean {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return false
  // Basic validation: each part should be a number, range, wildcard, or list
  return parts.every((part) => /^[\d\*,\-\/]+$/.test(part))
}

/**
 * Validate trigger configuration
 */
function validateTrigger(trigger: ParsedTrigger, index: number): LintError[] {
  const errors: LintError[] = []
  const path = `on[${index}]`

  // Check if trigger event is valid
  if (!VALID_TRIGGER_EVENTS.has(trigger.event)) {
    errors.push({
      message: `Invalid trigger event: "${trigger.event}". Valid events: ${Array.from(VALID_TRIGGER_EVENTS).slice(0, 10).join(', ')}, ...`,
      path: `${path}.${trigger.event}`,
      severity: 'error',
    })
  }

  const config = trigger.config

  // Validate push/pull_request branches/tags
  if (trigger.event === 'push' || trigger.event === 'pull_request') {
    if ('branches' in config && config.branches) {
      const branches = Array.isArray(config.branches) ? config.branches : [config.branches]
      if (!branches.every((b) => typeof b === 'string')) {
        errors.push({
          message: `Invalid branches format in ${trigger.event} trigger. Branches must be strings.`,
          path: `${path}.${trigger.event}.branches`,
          severity: 'error',
        })
      }
    }
    if ('tags' in config && config.tags) {
      const tags = Array.isArray(config.tags) ? config.tags : [config.tags]
      if (!tags.every((t) => typeof t === 'string')) {
        errors.push({
          message: `Invalid tags format in ${trigger.event} trigger. Tags must be strings.`,
          path: `${path}.${trigger.event}.tags`,
          severity: 'error',
        })
      }
    }
    if ('paths' in config && config.paths) {
      const paths = Array.isArray(config.paths) ? config.paths : [config.paths]
      if (!paths.every((p) => typeof p === 'string')) {
        errors.push({
          message: `Invalid paths format in ${trigger.event} trigger. Paths must be strings.`,
          path: `${path}.${trigger.event}.paths`,
          severity: 'error',
        })
      }
    }
    if ('paths-ignore' in config && config.pathsIgnore) {
      const pathsIgnore = Array.isArray(config.pathsIgnore)
        ? config.pathsIgnore
        : [config.pathsIgnore]
      if (!pathsIgnore.every((p) => typeof p === 'string')) {
        errors.push({
          message: `Invalid paths-ignore format in ${trigger.event} trigger. Paths must be strings.`,
          path: `${path}.${trigger.event}.paths-ignore`,
          severity: 'error',
        })
      }
    }
  }

  // Validate pull_request types
  if (trigger.event === 'pull_request' && config.types) {
    const types = Array.isArray(config.types) ? config.types : [config.types]
    for (const type of types) {
      if (typeof type === 'string' && !VALID_PULL_REQUEST_TYPES.has(type)) {
        errors.push({
          message: `Invalid pull_request type: "${type}". Valid types: ${Array.from(VALID_PULL_REQUEST_TYPES).slice(0, 10).join(', ')}, ...`,
          path: `${path}.${trigger.event}.types`,
          severity: 'warning',
        })
      }
    }
  }

  // Validate workflow_run
  if (trigger.event === 'workflow_run') {
    if (config.types) {
      const types = Array.isArray(config.types) ? config.types : [config.types]
      for (const type of types) {
        if (typeof type === 'string' && !VALID_WORKFLOW_RUN_ACTIVITIES.has(type)) {
          errors.push({
            message: `Invalid workflow_run activity type: "${type}". Valid types: completed, requested`,
            path: `${path}.${trigger.event}.types`,
            severity: 'error',
          })
        }
      }
    }
    if (!config.workflows || (typeof config.workflows !== 'string' && !Array.isArray(config.workflows))) {
      errors.push({
        message: 'workflow_run trigger requires a "workflows" field (string or array of strings)',
        path: `${path}.${trigger.event}`,
        severity: 'error',
      })
    }
  }

  // Validate schedule cron
  if (trigger.event === 'schedule') {
    if (!config.cron || typeof config.cron !== 'string') {
      errors.push({
        message: 'schedule trigger requires a "cron" field (string)',
        path: `${path}.${trigger.event}`,
        severity: 'error',
      })
    } else if (!isValidCron(config.cron)) {
      errors.push({
        message: `Invalid cron expression: "${config.cron}". Format: "minute hour day month weekday" (e.g., "0 0 * * *")`,
        path: `${path}.${trigger.event}.cron`,
        severity: 'error',
      })
    }
  }

  return errors
}

/**
 * Validate job configuration
 */
function validateJob(jobId: string, job: WorkflowJob, allJobIds: string[]): LintError[] {
  const errors: LintError[] = []
  const path = `jobs.${jobId}`

  // Validate runs-on
  if (!job['runs-on']) {
    errors.push({
      message: `Job "${jobId}" is missing required field "runs-on"`,
      path: `${path}.runs-on`,
      severity: 'error',
    })
  } else {
    const runners = Array.isArray(job['runs-on']) ? job['runs-on'] : [job['runs-on']]
    for (const runner of runners) {
      if (typeof runner === 'string' && !runner.startsWith('self-hosted') && !VALID_RUNNERS.has(runner)) {
        // Allow custom runner labels (e.g., self-hosted with labels)
        if (!runner.includes('[') && !runner.includes('${{')) {
          errors.push({
            message: `Unknown runner label: "${runner}". Common runners: ${Array.from(VALID_RUNNERS).join(', ')}`,
            path: `${path}.runs-on`,
            severity: 'warning',
          })
        }
      }
    }
  }

  // Validate needs (job dependencies)
  if (job.needs) {
    const needs = Array.isArray(job.needs) ? job.needs : [job.needs]
    for (const need of needs) {
      if (typeof need === 'string' && !allJobIds.includes(need)) {
        errors.push({
          message: `Job "${jobId}" depends on job "${need}" which does not exist`,
          path: `${path}.needs`,
          severity: 'error',
        })
      }
    }
  }

  // Validate strategy.matrix
  if (job.strategy?.matrix) {
    const matrix = job.strategy.matrix
    if (Object.keys(matrix).length === 0) {
      errors.push({
        message: `Job "${jobId}" has an empty matrix. Remove strategy or add matrix variables.`,
        path: `${path}.strategy.matrix`,
        severity: 'warning',
      })
    } else {
      for (const [key, values] of Object.entries(matrix)) {
        if (!Array.isArray(values) || values.length === 0) {
          errors.push({
            message: `Matrix variable "${key}" in job "${jobId}" must be a non-empty array`,
            path: `${path}.strategy.matrix.${key}`,
            severity: 'error',
          })
        }
      }
    }
    if (job.strategy['max-parallel'] !== undefined && job.strategy['max-parallel'] < 1) {
      errors.push({
        message: `max-parallel in job "${jobId}" must be at least 1`,
        path: `${path}.strategy.max-parallel`,
        severity: 'error',
      })
    }
  }

  // Validate steps
  if (!job.steps || job.steps.length === 0) {
    errors.push({
      message: `Job "${jobId}" has no steps`,
      path: `${path}.steps`,
      severity: 'warning',
    })
  } else {
    job.steps.forEach((step, stepIndex) => {
      const stepPath = `${path}.steps[${stepIndex}]`
      if (!step.run && !step.uses) {
        errors.push({
          message: `Step ${stepIndex + 1} in job "${jobId}" must have either "run" or "uses"`,
          path: stepPath,
          severity: 'error',
        })
      }
      if (step.run && step.uses) {
        errors.push({
          message: `Step ${stepIndex + 1} in job "${jobId}" cannot have both "run" and "uses"`,
          path: stepPath,
          severity: 'error',
        })
      }
      if (step.uses && typeof step.uses === 'string') {
        // Basic validation: uses should be in format owner/repo@ref or owner/repo/path@ref
        if (!/^[\w\-\.]+\/[\w\-\.]+(@[\w\.\-]+)?(\/[\w\-\.\/]+)?(@[\w\.\-]+)?$/.test(step.uses)) {
          errors.push({
            message: `Invalid action reference format: "${step.uses}". Expected format: "owner/repo@ref"`,
            path: `${stepPath}.uses`,
            severity: 'warning',
          })
        }
      }
    })
  }

  return errors
}

/**
 * Check for circular dependencies in job needs
 */
function checkCircularDependencies(jobs: Record<string, WorkflowJob>): LintError[] {
  const errors: LintError[] = []
  const visited = new Set<string>()
  const recursionStack = new Set<string>()

  function hasCycle(jobId: string): boolean {
    if (recursionStack.has(jobId)) {
      return true
    }
    if (visited.has(jobId)) {
      return false
    }

    visited.add(jobId)
    recursionStack.add(jobId)

    const job = jobs[jobId]
    if (job?.needs) {
      const needs = Array.isArray(job.needs) ? job.needs : [job.needs]
      for (const need of needs) {
        if (typeof need === 'string' && hasCycle(need)) {
          return true
        }
      }
    }

    recursionStack.delete(jobId)
    return false
  }

  for (const jobId of Object.keys(jobs)) {
    if (!visited.has(jobId) && hasCycle(jobId)) {
      errors.push({
        message: `Circular dependency detected involving job "${jobId}"`,
        path: `jobs.${jobId}.needs`,
        severity: 'error',
      })
    }
  }

  return errors
}

/**
 * Lint a GitHub Actions workflow
 */
export function lintWorkflow(workflow: Workflow): LintError[] {
  const errors: LintError[] = []

  // Validate triggers
  const triggers = parseTriggers(workflow.on)
  if (triggers.length === 0) {
    errors.push({
      message: 'Workflow must have at least one trigger in "on" field',
      path: 'on',
      severity: 'error',
    })
  } else {
    triggers.forEach((trigger, index) => {
      errors.push(...validateTrigger(trigger, index))
    })
  }

  // Validate jobs
  const jobIds = Object.keys(workflow.jobs)
  if (jobIds.length === 0) {
    errors.push({
      message: 'Workflow must have at least one job',
      path: 'jobs',
      severity: 'error',
    })
  } else {
    // Check for circular dependencies
    errors.push(...checkCircularDependencies(workflow.jobs))

    // Validate each job
    jobIds.forEach((jobId) => {
      errors.push(...validateJob(jobId, workflow.jobs[jobId], jobIds))
    })
  }

  return errors
}
