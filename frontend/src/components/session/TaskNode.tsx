import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Clock, Loader2, Check, X, AlertTriangle, MessageCircleQuestion } from 'lucide-react'
import type { TaskStatus } from '../../types'

interface TaskNodeData {
  label: string
  status: TaskStatus
  agentName: string
  selected: boolean
}

const statusConfig: Record<TaskStatus, { icon: JSX.Element; ring: string; bg: string; glow: string }> = {
  pending: {
    icon: <Clock size={12} />,
    ring: 'ring-zinc-600',
    bg: 'bg-[#111114] border-white/[0.08]',
    glow: '',
  },
  queued: {
    icon: <Loader2 size={12} className="animate-spin" />,
    ring: 'ring-amber-500/60',
    bg: 'bg-[#111114] border-amber-500/25',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.08)]',
  },
  running: {
    icon: <Loader2 size={12} className="animate-spin" />,
    ring: 'ring-blue-400/60',
    bg: 'bg-[#111114] border-blue-400/25',
    glow: 'shadow-[0_0_12px_rgba(96,165,250,0.10)]',
  },
  completed: {
    icon: <Check size={12} />,
    ring: 'ring-emerald-500/60',
    bg: 'bg-[#111114] border-emerald-500/25',
    glow: '',
  },
  failed: {
    icon: <AlertTriangle size={12} />,
    ring: 'ring-red-500/60',
    bg: 'bg-[#111114] border-red-500/25',
    glow: '',
  },
  cancelled: {
    icon: <X size={12} />,
    ring: 'ring-zinc-600',
    bg: 'bg-[#111114] border-white/[0.06]',
    glow: '',
  },
  awaiting_input: {
    icon: <MessageCircleQuestion size={12} />,
    ring: 'ring-purple-500/60',
    bg: 'bg-[#111114] border-purple-500/25',
    glow: 'shadow-[0_0_12px_rgba(168,85,247,0.10)]',
  },
}

const statusTextColor: Record<TaskStatus, string> = {
  pending: 'text-zinc-500',
  queued: 'text-amber-400',
  running: 'text-blue-400',
  completed: 'text-emerald-400',
  failed: 'text-red-400',
  cancelled: 'text-zinc-500',
  awaiting_input: 'text-purple-400',
}

function TaskNodeComponent({ data }: { data: TaskNodeData }) {
  const config = statusConfig[data.status] || statusConfig.pending
  const textColor = statusTextColor[data.status] || 'text-zinc-500'

  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-zinc-600 !border-zinc-500 !w-2 !h-2" />
      <div
        className={`px-4 py-3 rounded-xl border min-w-[160px] max-w-[220px] transition-colors duration-200 ${config.bg} ${config.glow} ${
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
          <span className="text-[10px] text-zinc-600 truncate">{data.agentName}</span>
          <span className={`text-[10px] capitalize ${textColor}`}>{data.status}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-zinc-600 !border-zinc-500 !w-2 !h-2" />
    </>
  )
}

export const TaskNode = memo(TaskNodeComponent)
