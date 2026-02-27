import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, CheckCircle, XCircle, Pause, Clock } from 'lucide-react'
import type { RecentSessionInfo } from '../../types'

interface Props {
  data: RecentSessionInfo[]
}

const statusConfig: Record<string, { icon: typeof Play; color: string; bg: string }> = {
  running: { icon: Play, color: 'text-blue-400', bg: 'bg-blue-400' },
  completed: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400' },
  paused: { icon: Pause, color: 'text-amber-400', bg: 'bg-amber-400' },
  planning: { icon: Clock, color: 'text-zinc-400', bg: 'bg-zinc-400' },
}

export const RecentSessionsList = memo(function RecentSessionsList({ data }: Props) {
  const navigate = useNavigate()

  return (
    <div className="bg-[#111114] border border-white/[0.06] rounded-xl p-5 shadow-card">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Recent Sessions</h3>
      <div className="space-y-2.5">
        {(!data || data.length === 0) ? (
          <p className="text-sm text-zinc-600 text-center py-6">No sessions yet</p>
        ) : (
          data.map((s) => {
            const cfg = statusConfig[s.status] ?? statusConfig.planning
            const Icon = cfg.icon
            const pct = s.total_tasks > 0 ? (s.done_tasks / s.total_tasks) * 100 : 0
            return (
              <button
                key={s.id}
                onClick={() => navigate(`/workspace/${s.id}`)}
                className="group w-full text-left px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-transparent hover:border-white/[0.06]"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon size={14} className={cfg.color} />
                  <span className="text-sm text-zinc-200 truncate flex-1">{s.name || 'Unnamed Session'}</span>
                  <span className="text-xs text-zinc-500">{s.done_tasks}/{s.total_tasks}</span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
                    }}
                  />
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
})
