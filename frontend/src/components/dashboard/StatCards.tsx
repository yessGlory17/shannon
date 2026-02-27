import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Bot, Users, Play } from 'lucide-react'

interface Props {
  projectCount: number
  agentCount: number
  teamCount: number
  sessionCount: number
}

const cardDefs = [
  { key: 'workspaces', label: 'Workspaces', icon: FolderOpen, path: '/projects', color: 'text-blue-400', iconBg: 'bg-blue-400/10', cardGlow: 'from-blue-500/[0.06]' },
  { key: 'agents', label: 'Agents', icon: Bot, path: '/agents', color: 'text-emerald-400', iconBg: 'bg-emerald-400/10', cardGlow: 'from-emerald-500/[0.06]' },
  { key: 'teams', label: 'Teams', icon: Users, path: '/teams', color: 'text-purple-400', iconBg: 'bg-purple-400/10', cardGlow: 'from-purple-500/[0.06]' },
  { key: 'sessions', label: 'Sessions', icon: Play, path: '/sessions', color: 'text-amber-400', iconBg: 'bg-amber-400/10', cardGlow: 'from-amber-500/[0.06]' },
]

export const StatCards = memo(function StatCards({ projectCount, agentCount, teamCount, sessionCount }: Props) {
  const navigate = useNavigate()
  const counts = [projectCount, agentCount, teamCount, sessionCount]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cardDefs.map((card, i) => {
        const Icon = card.icon
        return (
          <button
            key={card.key}
            onClick={() => navigate(card.path)}
            className={`card-item bg-gradient-to-br ${card.cardGlow} to-transparent bg-[#111114] border border-white/[0.06] hover:border-white/[0.10] rounded-xl p-5 text-left`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`${card.iconBg} w-9 h-9 rounded-full flex items-center justify-center`}>
                <Icon size={18} className={card.color} />
              </div>
              <span className="text-2xl font-semibold text-zinc-100">{counts[i]}</span>
            </div>
            <p className="text-sm text-zinc-400">{card.label}</p>
          </button>
        )
      })}
    </div>
  )
})
