import YAML from 'yaml'
import type { Workflow } from '@/types/workflow'

/**
 * Serialize workflow model to YAML string.
 * Produces valid GitHub Actions workflow YAML.
 */
export function serializeWorkflow(workflow: Workflow): string {
  const obj: Record<string, unknown> = {
    ...workflow,
  }

  if (workflow.name !== undefined) obj.name = workflow.name
  if (workflow['run-name'] !== undefined) obj['run-name'] = workflow['run-name']
  obj.on = workflow.on
  if (workflow.env && Object.keys(workflow.env).length > 0) obj.env = workflow.env

  const jobs: Record<string, unknown> = {}
  for (const [jobId, job] of Object.entries(workflow.jobs)) {
    const { steps, ...rest } = job
    const j: Record<string, unknown> = {
      ...rest,
      'runs-on': job['runs-on'],
      steps: steps.map((s) => stepToSerializable(s)),
    }
    jobs[jobId] = j
  }
  obj.jobs = jobs

  return YAML.stringify(obj, {
    indent: 2,
    lineWidth: 0,
    collectionStyle: 'block',
    defaultStringType: 'PLAIN',
  })
}

function stepToSerializable(step: import('@/types/workflow').WorkflowStep): Record<string, unknown> {
  const { id, name, uses, run, with: withObj, env, shell, ...rest } = step
  const out: Record<string, unknown> = { ...rest }
  if (id !== undefined) out.id = id
  if (name !== undefined) out.name = name
  if (uses !== undefined) out.uses = uses
  if (run !== undefined) out.run = run
  if (withObj && Object.keys(withObj).length > 0) out.with = withObj
  if (env && Object.keys(env).length > 0) out.env = env
  if (shell !== undefined) out.shell = shell
  return out
}
