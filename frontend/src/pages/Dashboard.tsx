import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Activity, BarChart3, Bot, Users } from 'lucide-react'
import type { DashboardDetails } from '../types'

import { StatCards } from '../components/dashboard/StatCards'
import { RunningTasksBanner } from '../components/dashboard/RunningTasksBanner'
import { TaskStatusChart } from '../components/dashboard/TaskStatusChart'
import { SessionStatusChart } from '../components/dashboard/SessionStatusChart'
import { TaskSuccessGauge } from '../components/dashboard/TaskSuccessGauge'
import { CompletionTrendChart } from '../components/dashboard/CompletionTrendChart'
import { AgentLeaderboard } from '../components/dashboard/AgentLeaderboard'
import { ModelDistributionChart } from '../components/dashboard/ModelDistributionChart'
import { RecentSessionsList } from '../components/dashboard/RecentSessionsList'
import { ActiveTasksList } from '../components/dashboard/ActiveTasksList'
import { CodeReviewCard } from '../components/dashboard/CodeReviewCard'
import { TeamActivityChart } from '../components/dashboard/TeamActivityChart'
import { ProjectActivityChart } from '../components/dashboard/ProjectActivityChart'

export function Dashboard() {
  const navigate = useNavigate()
  const [details, setDetails] = useState<DashboardDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let interval: ReturnType<typeof setInterval> | null = null

    const load = () => {
      window.go?.main?.App?.GetDashboardDetails?.()
        .then((d) => { if (mounted) setDetails(d) })
        .catch(console.error)
        .finally(() => { if (mounted) setLoading(false) })
    }

    const startPolling = () => {
      if (interval) clearInterval(interval)
      interval = setInterval(load, 300000)
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (interval) { clearInterval(interval); interval = null }
      } else {
        load()
        startPolling()
      }
    }

    load()
    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      mounted = false
      if (interval) clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const steps = [
    { label: 'Add a workspace to work on', path: '/projects' },
    { label: 'Create agents with specific capabilities', path: '/agents' },
    { label: 'Organize agents into teams', path: '/teams' },
    { label: 'Start a session and assign tasks', path: '/sessions' },
  ]

  if (loading) {
    return (
      <div className="w-full space-y-6">
        <h1 className="text-2xl font-bold font-display text-zinc-100">Dashboard</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#111114] border border-white/[0.06] rounded-xl p-5 h-[100px]" />
          ))}
        </div>
        <div className="bg-[#111114] border border-white/[0.06] rounded-xl p-5 h-[60px]" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#111114] border border-white/[0.06] rounded-xl p-5 h-[280px]" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-display text-zinc-100">Dashboard</h1>
        <div className="flex items-center gap-1.5 text-xs text-zinc-600">
          <Activity size={12} />
          <span>Auto-refreshes every 5m</span>
        </div>
      </div>

      {/* Row 1: Stat Cards */}
      <StatCards
        projectCount={details?.project_count ?? 0}
        agentCount={details?.agent_count ?? 0}
        teamCount={details?.team_count ?? 0}
        sessionCount={details?.session_count ?? 0}
      />

      {/* Row 2: Running Tasks Banner */}
      <RunningTasksBanner count={details?.running_tasks ?? 0} />

      {/* Row 3: Task & Session Charts */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={14} className="text-zinc-500" />
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Overview</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <TaskStatusChart data={details?.task_status_dist ?? []} />
          <SessionStatusChart data={details?.session_status_dist ?? []} />
          <TaskSuccessGauge rate={details?.task_success_rate ?? 0} />
          <CodeReviewCard data={details?.code_review ?? null} />
        </div>
      </div>

      {/* Row 4: Completion Trend */}
      <CompletionTrendChart data={details?.task_completion_trend ?? []} />

      {/* Row 5: Agent Performance */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Bot size={14} className="text-zinc-500" />
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Agent Performance</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <AgentLeaderboard data={details?.agent_leaderboard ?? []} />
          </div>
          <ModelDistributionChart data={details?.model_distribution ?? []} />
        </div>
      </div>

      {/* Row 6: Recent Activity */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Activity size={14} className="text-zinc-500" />
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Recent Activity</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RecentSessionsList data={details?.recent_sessions ?? []} />
          <ActiveTasksList data={details?.active_tasks ?? []} />
        </div>
      </div>

      {/* Row 7: Team & Project Stats */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users size={14} className="text-zinc-500" />
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Teams & Projects</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TeamActivityChart
            teams={details?.team_activities ?? []}
            strategyDist={details?.strategy_dist ?? []}
          />
          <ProjectActivityChart data={details?.project_activities ?? []} />
        </div>
      </div>

      {/* Row 8: Quick Start (collapsed) */}
      <details className="bg-[#111114] border border-white/[0.06] rounded-xl shadow-card group">
        <summary className="px-6 py-4 cursor-pointer text-sm font-display font-semibold text-zinc-400 hover:text-zinc-200 flex items-center gap-2">
          <ChevronRight size={14} className="group-open:rotate-90" />
          Quick Start Guide
        </summary>
        <div className="px-6 pb-4 space-y-2">
          {steps.map((step, index) => (
            <button
              key={step.path}
              onClick={() => navigate(step.path)}
              className="group/step w-full text-left px-4 py-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-transparent hover:border-white/[0.06] text-sm text-zinc-300 flex items-center gap-3"
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-medium text-zinc-500 group-hover/step:text-zinc-300">
                {index + 1}
              </span>
              <span className="flex-1">{step.label}</span>
              <ChevronRight size={14} className="text-zinc-600 opacity-0 group-hover/step:opacity-100" />
            </button>
          ))}
        </div>
      </details>
    </div>
  )
}
