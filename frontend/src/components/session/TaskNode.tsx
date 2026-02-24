import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Clock, Loader2, Check, X, AlertTriangle } from 'lucide-react'
import type { TaskStatus } from '../../types'

interface TaskNodeData {
  label: string
  status: TaskStatus
  agentName: string
  selected: boolean
}

const statusConfig: Record<TaskStatus, { icon: JSX.Element; ring: string; bg: string }> = {
  pending: {
    icon: <Clock size={12} />,
    ring: 'ring-zinc-600',
    bg: 'bg-zinc-800 border-zinc-700',
  },
  queued: {
    icon: <Loader2 size={12} className="animate-spin" />,
    ring: 'ring-amber-500',
    bg: 'bg-zinc-800 border-amber-600/50',
  },
  running: {
    icon: <Loader2 size={12} className="animate-spin" />,
    ring: 'ring-blue-500',
    bg: 'bg-zinc-800 border-blue-500/50',
  },
  completed: {
    icon: <Check size={12} />,
    ring: 'ring-emerald-500',
    bg: 'bg-zinc-800 border-emerald-600/50',
  },
  failed: {
    icon: <AlertTriangle size={12} />,
    ring: 'ring-red-500',
    bg: 'bg-zinc-800 border-red-600/50',
  },
  cancelled: {
    icon: <X size={12} />,
    ring: 'ring-zinc-600',
    bg: 'bg-zinc-800 border-zinc-600',
  },
}

const statusTextColor: Record<TaskStatus, string> = {
  pending: 'text-zinc-500',
  queued: 'text-amber-400',
  running: 'text-blue-400',
  completed: 'text-emerald-400',
  failed: 'text-red-400',
  cancelled: 'text-zinc-500',
}

function TaskNodeComponent({ data }: { data: TaskNodeData }) {
  const config = statusConfig[data.status] || statusConfig.pending
  const textColor = statusTextColor[data.status] || 'text-zinc-500'

  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-zinc-600 !border-zinc-500 !w-2 !h-2" />
      <div
        className={`px-4 py-3 rounded-lg border min-w-[160px] max-w-[220px] transition-all ${config.bg} ${
          data.selected ? `ring-2 ${config.ring}` : ''
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={textColor}>{config.icon}</span>
          <span className="text-xs font-medium text-zinc-200 truncate flex-1">
            {data.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 truncate">{data.agentName}</span>
          <span className={`text-[10px] capitalize ${textColor}`}>{data.status}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-zinc-600 !border-zinc-500 !w-2 !h-2" />
    </>
  )
}

export const TaskNode = memo(TaskNodeComponent)
