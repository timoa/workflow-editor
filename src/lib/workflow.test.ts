import { describe, it, expect } from 'vitest'
import { parseWorkflow } from './parseWorkflow'
import { serializeWorkflow } from './serializeWorkflow'

const minimalWorkflow = `
name: Minimal
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hello
`

const workflowWithNeeds = `
name: With Needs
on: [push, pull_request]
jobs:
  one:
    runs-on: ubuntu-latest
    steps:
      - run: echo one
  two:
    needs: one
    runs-on: ubuntu-latest
    steps:
      - run: echo two
`

const workflowWithSteps = `
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Build
        run: pnpm build
`

describe('parseWorkflow', () => {
  it('parses minimal workflow', () => {
    const { workflow, errors } = parseWorkflow(minimalWorkflow)
    expect(errors).toEqual([])
    expect(workflow.name).toBe('Minimal')
    expect(workflow.on).toBeDefined()
    expect(Object.keys(workflow.jobs)).toContain('build')
    expect(workflow.jobs.build['runs-on']).toBe('ubuntu-latest')
    expect(workflow.jobs.build.steps).toHaveLength(1)
    expect(workflow.jobs.build.steps[0].run).toBe('echo hello')
  })

  it('parses workflow with needs', () => {
    const { workflow, errors } = parseWorkflow(workflowWithNeeds)
    expect(errors).toEqual([])
    expect(workflow.jobs.one).toBeDefined()
    expect(workflow.jobs.two).toBeDefined()
    expect(workflow.jobs.two.needs).toBe('one')
  })

  it('parses workflow with uses and with', () => {
    const { workflow, errors } = parseWorkflow(workflowWithSteps)
    expect(errors).toEqual([])
    const steps = workflow.jobs.deploy.steps
    expect(steps[0].uses).toBe('actions/checkout@v4')
    expect(steps[1].name).toBe('Setup Node')
    expect(steps[1].uses).toBe('actions/setup-node@v4')
    expect(steps[1].with).toEqual({ 'node-version': 22 })
    expect(steps[2].run).toBe('pnpm build')
  })

  it('returns errors for invalid YAML', () => {
    const { errors } = parseWorkflow('not: valid: yaml: [')
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]).toMatch(/YAML|parse|error/i)
  })

  it('returns errors when jobs is missing', () => {
    const { workflow, errors } = parseWorkflow('name: No jobs\non: push\n')
    expect(errors.some((e) => e.includes('jobs'))).toBe(true)
    expect(workflow.jobs).toEqual({})
  })
})

describe('serializeWorkflow', () => {
  it('serializes minimal workflow to valid YAML', () => {
    const { workflow } = parseWorkflow(minimalWorkflow)
    const yaml = serializeWorkflow(workflow)
    expect(yaml).toContain('name: Minimal')
    expect(yaml).toContain('runs-on: ubuntu-latest')
    expect(yaml).toContain('echo hello')
  })

  it('round-trips minimal workflow', () => {
    const { workflow } = parseWorkflow(minimalWorkflow)
    const yaml = serializeWorkflow(workflow)
    const { workflow: again, errors } = parseWorkflow(yaml)
    expect(errors).toEqual([])
    expect(again.name).toBe(workflow.name)
    expect(again.jobs.build.steps[0].run).toBe(workflow.jobs.build.steps[0].run)
  })

  it('round-trips workflow with needs', () => {
    const { workflow } = parseWorkflow(workflowWithNeeds)
    const yaml = serializeWorkflow(workflow)
    const { workflow: again, errors } = parseWorkflow(yaml)
    expect(errors).toEqual([])
    expect(again.jobs.two.needs).toBe('one')
  })

  it('round-trips workflow with steps (uses, with)', () => {
    const { workflow } = parseWorkflow(workflowWithSteps)
    const yaml = serializeWorkflow(workflow)
    const { workflow: again, errors } = parseWorkflow(yaml)
    expect(errors).toEqual([])
    expect(again.jobs.deploy.steps[1].with).toEqual({ 'node-version': 22 })
    expect(again.jobs.deploy.steps[2].run).toBe('pnpm build')
  })
})
