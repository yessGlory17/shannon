import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, Trash2, GitBranch } from 'lucide-react'
import { useTeamStore } from '../stores/teamStore'
import { useAgentStore } from '../stores/agentStore'

const strategyLabels: Record<string, { label: string; color: string }> = {
  parallel: { label: 'Parallel', color: 'text-blue-400 bg-blue-900/30' },
  sequential: { label: 'Sequential', color: 'text-amber-400 bg-amber-900/30' },
  planner: { label: 'Custom', color: 'text-purple-400 bg-purple-900/30' },
}

export function TeamList() {
  const navigate = useNavigate()
  const { teams, loading, fetch, remove } = useTeamStore()
  const { agents, fetch: fetchAgents } = useAgentStore()

  useEffect(() => {
    fetch()
    fetchAgents()
  }, [fetch, fetchAgents])

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
          <h1 className="text-xl font-semibold text-zinc-100">Teams</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Create agent teams with visual workflow editors
          </p>
        </div>
        <button
          onClick={() => navigate('/teams/new')}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-900 text-sm font-medium rounded-md transition-colors"
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
        ) : teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
              <Users size={20} className="text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500 mb-1">No teams yet</p>
            <p className="text-xs text-zinc-600 mb-4">
              Create a team to define agent workflows
            </p>
            <button
              onClick={() => navigate('/teams/new')}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-md transition-colors"
            >
              <Plus size={12} />
              Create Team
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {teams.map((team) => {
              const strategy = strategyLabels[team.strategy] || strategyLabels.parallel
              const agentCount = team.agent_ids?.length || team.nodes?.length || 0
              const edgeCount = team.edges?.length || 0

              return (
                <button
                  key={team.id}
                  onClick={() => navigate(`/teams/${team.id}/edit`)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors text-left p-4"
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
                      className="p-1.5 rounded text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors ml-2"
                    >
                      <Trash2 size={14} />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
