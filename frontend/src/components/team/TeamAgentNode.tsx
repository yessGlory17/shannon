import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Bot, X } from 'lucide-react'

interface TeamAgentNodeData {
  label: string
  model: string
  onDelete?: () => void
}

function TeamAgentNodeComponent({ data }: { data: TeamAgentNodeData }) {
  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-zinc-500 !border-zinc-400 !w-2.5 !h-2.5"
      />
      <div className="group relative px-4 py-3 rounded-xl border border-white/[0.08] bg-[#111114] min-w-[160px] hover:border-white/[0.14] transition-all duration-150">
        <div className="flex items-center gap-2">
          <Bot size={14} className="text-brand-blue" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{data.label}</p>
            <p className="text-[10px] text-zinc-600">{data.model}</p>
          </div>
        </div>
        {data.onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              data.onDelete?.()
            }}
            className="absolute -top-2 -right-2 p-0.5 bg-zinc-800 border border-white/[0.10] rounded-full text-zinc-500 hover:text-red-400 hover:border-red-500/50 opacity-0 group-hover:opacity-100 transition-all"
          >
            <X size={10} />
          </button>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-zinc-500 !border-zinc-400 !w-2.5 !h-2.5"
      />
    </>
  )
}

export const TeamAgentNode = memo(TeamAgentNodeComponent)
