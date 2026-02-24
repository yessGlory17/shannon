import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Bot, Users, Play, Zap } from 'lucide-react'
import type { DashboardStats } from '../types'

export function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    window.go?.main?.App?.GetDashboardStats?.().then(setStats).catch(console.error)
  }, [])

  const cards = [
    { label: 'Projects', count: stats?.project_count ?? 0, icon: FolderOpen, path: '/projects', color: 'text-blue-400' },
    { label: 'Agents', count: stats?.agent_count ?? 0, icon: Bot, path: '/agents', color: 'text-emerald-400' },
    { label: 'Teams', count: stats?.team_count ?? 0, icon: Users, path: '/teams', color: 'text-purple-400' },
    { label: 'Sessions', count: stats?.session_count ?? 0, icon: Play, path: '/sessions', color: 'text-amber-400' },
  ]

  return (
    <div className="w-full">
      <h1 className="text-2xl font-semibold text-zinc-100 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.label}
              onClick={() => navigate(card.path)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 text-left hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <Icon size={20} className={card.color} />
                <span className="text-2xl font-semibold text-zinc-100">{card.count}</span>
              </div>
              <p className="text-sm text-zinc-400">{card.label}</p>
            </button>
          )
        })}
      </div>

      {/* Running tasks */}
      <div className="mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-amber-400" />
            <span className="text-xs text-zinc-400">Running Tasks</span>
          </div>
          <p className="text-lg font-semibold text-zinc-100">
            {stats?.running_tasks ?? 0}
          </p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h2 className="text-lg font-medium text-zinc-200 mb-3">Quick Start</h2>
        <div className="space-y-2">
          <button
            onClick={() => navigate('/projects')}
            className="w-full text-left px-4 py-3 rounded-md bg-zinc-800/50 hover:bg-zinc-800 text-sm text-zinc-300 transition-colors"
          >
            1. Add a project to work on
          </button>
          <button
            onClick={() => navigate('/agents')}
            className="w-full text-left px-4 py-3 rounded-md bg-zinc-800/50 hover:bg-zinc-800 text-sm text-zinc-300 transition-colors"
          >
            2. Create agents with specific capabilities
          </button>
          <button
            onClick={() => navigate('/teams')}
            className="w-full text-left px-4 py-3 rounded-md bg-zinc-800/50 hover:bg-zinc-800 text-sm text-zinc-300 transition-colors"
          >
            3. Organize agents into teams
          </button>
          <button
            onClick={() => navigate('/sessions')}
            className="w-full text-left px-4 py-3 rounded-md bg-zinc-800/50 hover:bg-zinc-800 text-sm text-zinc-300 transition-colors"
          >
            4. Start a session and assign tasks
          </button>
        </div>
      </div>
    </div>
  )
}
