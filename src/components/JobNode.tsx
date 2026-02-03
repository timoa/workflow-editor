import { memo } from 'react'
import { Handle, type NodeProps, Position } from '@xyflow/react'
import type { JobNodeData } from '@/lib/workflowToFlow'

function JobNodeComponent(props: NodeProps) {
  const { data, selected } = props
  const d = data as JobNodeData
  return (
    <div
      className={`
        min-w-[180px] rounded-lg border-2 bg-white px-3 py-2 shadow-sm
        ${selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'}
      `}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-2 !border-slate-400 !bg-white" />
      <div className="font-medium text-slate-800">{d.label}</div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
          {d.runsOn || 'ubuntu-latest'}
        </span>
        {d.stepCount > 0 && (
          <span className="text-xs text-slate-500">{d.stepCount} step{d.stepCount !== 1 ? 's' : ''}</span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-2 !border-slate-400 !bg-white" />
    </div>
  )
}

export const JobNode = memo(JobNodeComponent)
