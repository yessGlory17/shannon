import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Bot } from 'lucide-react'

interface TeamSubAgentNodeData {
  label: string
  model: string
}

function TeamSubAgentNodeComponent({ data }: { data: TeamSubAgentNodeData }) {
  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-zinc-500 !border-zinc-400 !w-2 !h-2" />
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/[0.08] bg-[#111114] min-w-[160px]">
        <Bot size={14} className="text-brand-blue flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-200 truncate">{data.label}</p>
          <p className="text-[10px] text-zinc-600 truncate">{data.model}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-zinc-500 !border-zinc-400 !w-2 !h-2" />
    </>
  )
}

export const TeamSubAgentNode = memo(TeamSubAgentNodeComponent)
