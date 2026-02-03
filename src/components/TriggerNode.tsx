import { memo } from 'react'
import { Handle, type NodeProps, Position } from '@xyflow/react'
import type { ParsedTrigger } from '@/lib/triggerUtils'
import { getTriggerLabel } from '@/lib/triggerUtils'

export type TriggerNodeData = {
  triggers: ParsedTrigger[]
}

function TriggerNodeComponent(props: NodeProps) {
  const { data, selected } = props
  const d = data as TriggerNodeData

  return (
    <div
      className={`
        min-w-[240px] rounded-lg border-2 bg-gradient-to-br from-purple-50 to-indigo-50 px-4 py-3 shadow-md
        ${selected ? 'border-purple-500 ring-2 ring-purple-200' : 'border-purple-300 hover:border-purple-400'}
      `}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-purple-500"></div>
        <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Trigger</div>
      </div>
      <div className="space-y-1.5">
        {d.triggers.length === 0 ? (
          <div className="text-sm text-slate-500 italic">No triggers configured</div>
        ) : (
          d.triggers.map((trigger, idx) => (
            <div key={idx} className="text-sm font-medium text-slate-800">
              {getTriggerLabel(trigger)}
            </div>
          ))
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-2 !border-purple-400 !bg-white" />
    </div>
  )
}

export const TriggerNode = memo(TriggerNodeComponent)
