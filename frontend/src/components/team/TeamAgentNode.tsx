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
      <div className="group relative px-4 py-3 rounded-lg border border-zinc-700 bg-zinc-800 min-w-[160px] hover:border-zinc-500 transition-colors">
        <div className="flex items-center gap-2">
          <Bot size={14} className="text-zinc-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{data.label}</p>
            <p className="text-[10px] text-zinc-500">{data.model}</p>
          </div>
        </div>
        {data.onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              data.onDelete?.()
            }}
            className="absolute -top-2 -right-2 p-0.5 bg-zinc-700 border border-zinc-600 rounded-full text-zinc-400 hover:text-red-400 hover:border-red-500 opacity-0 group-hover:opacity-100 transition-all"
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
