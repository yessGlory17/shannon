import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, Trash2, GitBranch } from 'lucide-react'
import { useTeamStore } from '../stores/teamStore'
import { useAgentStore } from '../stores/agentStore'
import { Pagination } from '../components/common/Pagination'

const strategyLabels: Record<string, { label: string; color: string }> = {
  parallel: { label: 'Parallel', color: 'text-blue-400 bg-blue-500/10' },
  sequential: { label: 'Sequential', color: 'text-amber-400 bg-amber-500/10' },
  planner: { label: 'Custom', color: 'text-purple-400 bg-purple-500/10' },
}

export function TeamList() {
  const navigate = useNavigate()
  const { teams, loading, pagination, fetchPaginated, remove } = useTeamStore()
  const { agents, fetch: fetchAgents } = useAgentStore()

  const goToPage = useCallback((p: number) => {
    fetchPaginated(p, pagination.pageSize)
  }, [fetchPaginated, pagination.pageSize])

  useEffect(() => {
    fetchPaginated(1)
    fetchAgents()
  }, [fetchPaginated, fetchAgents])

  const getAgentNames = (ids: string[]) => {
    if (!ids || ids.length === 0) return 'No agents'
    return ids
      .map((id) => agents.find((a) => a.id === id)?.name || id.slice(0, 8))
      .join(', ')
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await remove(id)
    } catch (err) {
      console.error('Failed to delete team:', err)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold font-display text-zinc-100">Teams</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Create agent teams with visual workflow editors
          </p>
        </div>
        <button
          onClick={() => navigate('/teams/new')}
          className="flex items-center gap-2 px-4 py-2 bg-brand-gradient hover:opacity-90 text-white text-sm font-medium rounded-lg transition-[color,background-color,border-color,box-shadow,opacity] shadow-brand-sm hover:shadow-brand"
        >
          <Plus size={14} />
          New Team
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading && teams.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-zinc-500">
            Loading...
          </div>
        ) : teams.length === 0 && pagination.totalItems === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center mb-4">
              <Users size={20} className="text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500 mb-1">No teams yet</p>
            <p className="text-xs text-zinc-600 mb-4">
              Create a team to define agent workflows
            </p>
            <button
              onClick={() => navigate('/teams/new')}
              className="flex items-center gap-2 px-3 py-2 bg-white/[0.06] hover:bg-white/[0.10] text-zinc-300 text-xs rounded-lg transition-colors"
            >
              <Plus size={12} />
              Create Team
            </button>
          </div>
        ) : (
          <>
          <div className="space-y-2">
            {teams.map((team) => {
              const strategy = strategyLabels[team.strategy] || strategyLabels.parallel
              const agentCount = team.agent_ids?.length || team.nodes?.length || 0
              const edgeCount = team.edges?.length || 0

              return (
                <button
                  key={team.id}
                  onClick={() => navigate(`/teams/${team.id}/edit`)}
                  className="card-item w-full rounded-xl bg-[#111114] border border-white/[0.06] hover:border-white/[0.10] shadow-card hover:shadow-card-hover transition-[color,background-color,border-color,box-shadow,opacity] duration-200 text-left p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium text-zinc-200">{team.name}</h3>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${strategy.color}`}>
                          {strategy.label}
                        </span>
                      </div>
                      {team.description && (
                        <p className="text-xs text-zinc-500 mb-2 line-clamp-1">{team.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-zinc-600">
                        <span className="flex items-center gap-1">
                          <Users size={10} />
                          {agentCount} agent{agentCount !== 1 ? 's' : ''}
                        </span>
                        {edgeCount > 0 && (
                          <span className="flex items-center gap-1">
                            <GitBranch size={10} />
                            {edgeCount} connection{edgeCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        <span className="truncate">{getAgentNames(team.agent_ids)}</span>
                      </div>
                    </div>
                    <div
                      onClick={(e) => handleDelete(e, team.id)}
                      className="p-1.5 rounded text-zinc-600 hover:text-red-400 hover:bg-white/[0.06] transition-colors ml-2"
                    >
                      <Trash2 size={14} />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          <Pagination page={pagination.page} totalPages={pagination.totalPages} totalItems={pagination.totalItems} onPageChange={goToPage} />
          </>
        )}
      </div>
    </div>
  )
}
