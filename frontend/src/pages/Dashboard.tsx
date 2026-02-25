import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Bot, Users, Play, Zap, ChevronRight } from 'lucide-react'
import type { DashboardStats } from '../types'

export function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    window.go?.main?.App?.GetDashboardStats?.().then(setStats).catch(console.error)
  }, [])

  const cards = [
    { label: 'Workspaces', count: stats?.project_count ?? 0, icon: FolderOpen, path: '/projects', color: 'text-blue-400', iconBg: 'bg-blue-400/10', cardGlow: 'from-blue-500/[0.06]' },
    { label: 'Agents', count: stats?.agent_count ?? 0, icon: Bot, path: '/agents', color: 'text-emerald-400', iconBg: 'bg-emerald-400/10', cardGlow: 'from-emerald-500/[0.06]' },
    { label: 'Teams', count: stats?.team_count ?? 0, icon: Users, path: '/teams', color: 'text-purple-400', iconBg: 'bg-purple-400/10', cardGlow: 'from-purple-500/[0.06]' },
    { label: 'Sessions', count: stats?.session_count ?? 0, icon: Play, path: '/sessions', color: 'text-amber-400', iconBg: 'bg-amber-400/10', cardGlow: 'from-amber-500/[0.06]' },
  ]

  const steps = [
    { label: 'Add a workspace to work on', path: '/projects' },
    { label: 'Create agents with specific capabilities', path: '/agents' },
    { label: 'Organize agents into teams', path: '/teams' },
    { label: 'Start a session and assign tasks', path: '/sessions' },
  ]

  return (
    <div className="w-full">
      <h1 className="text-2xl font-bold font-display text-zinc-100 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.label}
              onClick={() => navigate(card.path)}
              className={`bg-gradient-to-br ${card.cardGlow} to-transparent bg-[#111114] border border-white/[0.06] hover:border-white/[0.10] rounded-xl p-5 text-left shadow-card hover:shadow-card-hover transition-all duration-200`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`${card.iconBg} w-9 h-9 rounded-full flex items-center justify-center`}>
                  <Icon size={18} className={card.color} />
                </div>
                <span className="text-2xl font-semibold text-zinc-100">{card.count}</span>
              </div>
              <p className="text-sm text-zinc-400">{card.label}</p>
            </button>
          )
        })}
      </div>

      {/* Running tasks */}
      <div className="mb-8">
        <div className="relative overflow-hidden bg-[#111114] border border-white/[0.06] rounded-xl p-4 shadow-card">
          <div className="absolute inset-0 bg-brand-gradient opacity-[0.04] pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <div className="bg-amber-400/10 w-9 h-9 rounded-full flex items-center justify-center">
              <Zap size={16} className="text-amber-400" />
            </div>
            <div>
              <span className="text-xs text-zinc-500 block">Running Tasks</span>
              <p className="text-lg font-semibold text-zinc-100">{stats?.running_tasks ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#111114] border border-white/[0.06] rounded-xl p-6 shadow-card">
        <h2 className="text-lg font-display font-semibold text-zinc-200 mb-4">Quick Start</h2>
        <div className="space-y-2">
          {steps.map((step, index) => (
            <button
              key={step.path}
              onClick={() => navigate(step.path)}
              className="group w-full text-left px-4 py-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-transparent hover:border-white/[0.06] text-sm text-zinc-300 transition-all duration-200 flex items-center gap-3"
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-medium text-zinc-500 group-hover:text-zinc-300 transition-colors">
                {index + 1}
              </span>
              <span className="flex-1">{step.label}</span>
              <ChevronRight size={14} className="text-zinc-600 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
