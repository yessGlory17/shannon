import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Bot, Pencil } from 'lucide-react'
import { useAgentStore } from '../stores/agentStore'

export function AgentManager() {
  const navigate = useNavigate()
  const { agents, loading, fetch, remove } = useAgentStore()

  useEffect(() => {
    fetch()
  }, [fetch])

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Agents</h1>
        <button
          onClick={() => navigate('/agents/new')}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-md transition-colors"
        >
          <Plus size={16} />
          New Agent
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : agents.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <Bot size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">No agents defined. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-zinc-200">{agent.name}</h3>
                    <span className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">
                      {agent.model}
                    </span>
                  </div>
                  {agent.description && (
                    <p className="text-xs text-zinc-500 mt-1">{agent.description}</p>
                  )}
                  {agent.allowed_tools?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {agent.allowed_tools.map((tool) => (
                        <span
                          key={tool}
                          className="px-1.5 py-0.5 bg-zinc-800/80 rounded text-xs text-zinc-500"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 ml-3">
                  <button
                    onClick={() => navigate(`/agents/${agent.id}/edit`)}
                    className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => remove(agent.id)}
                    className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
