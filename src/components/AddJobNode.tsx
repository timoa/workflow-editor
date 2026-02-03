import { memo } from 'react'
import { Handle, type NodeProps, Position } from '@xyflow/react'

export type AddJobNodeData = {
  needs: string[]
}

function AddJobNodeComponent(props: NodeProps) {
  const { selected } = props
  return (
    <div
      className={`
        flex h-10 w-10 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white
        text-lg font-light text-slate-500 shadow-sm transition-colors
        hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600
        ${selected ? 'border-blue-500 bg-blue-50 text-blue-600 ring-2 ring-blue-200' : ''}
      `}
      title="Add new job"
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-2 !border-slate-400 !bg-white" />
      +
    </div>
  )
}

export const AddJobNode = memo(AddJobNodeComponent)
