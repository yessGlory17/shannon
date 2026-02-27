import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Bot } from 'lucide-react'
import type { ActiveTaskInfo } from '../../types'

interface Props {
  data: ActiveTaskInfo[]
}

export const ActiveTasksList = memo(function ActiveTasksList({ data }: Props) {
  const navigate = useNavigate()

  return (
    <div className="bg-[#111114] border border-white/[0.06] rounded-xl p-5 shadow-card">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Active Tasks</h3>
      <div className="space-y-2.5">
        {(!data || data.length === 0) ? (
          <p className="text-sm text-zinc-600 text-center py-6">No running tasks</p>
        ) : (
          data.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(`/workspace/${t.session_id}`)}
              className="group w-full text-left px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-transparent hover:border-white/[0.06]"
            >
              <div className="flex items-center gap-2 mb-1">
                <Loader2 size={14} className="text-blue-400" />
                <span className="text-sm text-zinc-200 truncate flex-1">{t.title || 'Untitled Task'}</span>
              </div>
              {t.agent_name && (
                <div className="flex items-center gap-1.5 ml-6">
                  <Bot size={11} className="text-zinc-500" />
                  <span className="text-xs text-zinc-500">{t.agent_name}</span>
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
})
