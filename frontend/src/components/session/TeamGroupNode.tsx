import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Clock, Loader2, Check, X, AlertTriangle, Users } from 'lucide-react'
import type { TaskStatus } from '../../types'

interface TeamGroupNodeData {
  label: string
  status: TaskStatus
  teamName: string
  strategy: string
  selected: boolean
}

const statusBorder: Record<TaskStatus, string> = {
  pending: 'border-zinc-700',
  queued: 'border-amber-600/50',
  running: 'border-blue-500/50',
  completed: 'border-emerald-600/50',
  failed: 'border-red-600/50',
  cancelled: 'border-zinc-600',
}

const statusHeaderBg: Record<TaskStatus, string> = {
  pending: 'bg-zinc-800',
  queued: 'bg-amber-950/40',
  running: 'bg-blue-950/40',
  completed: 'bg-emerald-950/40',
  failed: 'bg-red-950/40',
  cancelled: 'bg-zinc-800',
}

const statusIcon: Record<TaskStatus, JSX.Element> = {
  pending: <Clock size={10} className="text-zinc-500" />,
  queued: <Loader2 size={10} className="text-amber-400 animate-spin" />,
  running: <Loader2 size={10} className="text-blue-400 animate-spin" />,
  completed: <Check size={10} className="text-emerald-400" />,
  failed: <AlertTriangle size={10} className="text-red-400" />,
  cancelled: <X size={10} className="text-zinc-500" />,
}

const statusRing: Record<TaskStatus, string> = {
  pending: 'ring-zinc-600',
  queued: 'ring-amber-500',
  running: 'ring-blue-500',
  completed: 'ring-emerald-500',
  failed: 'ring-red-500',
  cancelled: 'ring-zinc-600',
}

function TeamGroupNodeComponent({ data }: { data: TeamGroupNodeData }) {
  const border = statusBorder[data.status] || statusBorder.pending
  const headerBg = statusHeaderBg[data.status] || statusHeaderBg.pending
  const icon = statusIcon[data.status] || statusIcon.pending
  const ring = statusRing[data.status] || statusRing.pending

  return (
    <>
      <Handle type="target" position={Position.Left} className="!bg-zinc-600 !border-zinc-500 !w-2 !h-2" />
      <div
        className={`rounded-lg border bg-zinc-900/80 overflow-hidden transition-all ${border} ${
          data.selected ? `ring-2 ${ring}` : ''
        }`}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Header */}
        <div className={`px-4 py-2.5 border-b ${border} ${headerBg} flex items-center gap-2`}>
          {icon}
          <span className="text-sm font-medium text-zinc-200 truncate flex-1">{data.label}</span>
          <span className="flex items-center gap-1 text-[10px] text-zinc-500 flex-shrink-0">
            <Users size={10} />
            {data.teamName}
          </span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-zinc-600 !border-zinc-500 !w-2 !h-2" />
    </>
  )
}

export const TeamGroupNode = memo(TeamGroupNodeComponent)
