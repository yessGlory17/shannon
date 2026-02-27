import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Bot, Pencil, Sparkles, Server } from 'lucide-react'
import { useAgentStore } from '../stores/agentStore'
import { Pagination } from '../components/common/Pagination'

export function AgentManager() {
  const navigate = useNavigate()
  const { agents, loading, pagination, fetchPaginated, remove, seedExamples } = useAgentStore()
  const [seeding, setSeeding] = useState(false)

  const goToPage = useCallback((p: number) => {
    fetchPaginated(p, pagination.pageSize)
  }, [fetchPaginated, pagination.pageSize])

  useEffect(() => {
    fetchPaginated(1)
  }, [fetchPaginated])

  const handleSeedExamples = async () => {
    setSeeding(true)
    try {
      await seedExamples()
    } catch (e: any) {
      console.error('Failed to seed examples:', e)
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display text-zinc-100">Agents</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSeedExamples}
            disabled={seeding}
            className="flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.10] text-zinc-300 text-sm rounded-lg px-3 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Create example agents with MCP servers"
          >
            <Sparkles size={14} className={seeding ? 'animate-pulse' : ''} />
            {seeding ? 'Creating...' : 'Create Examples'}
          </button>
          <button
            onClick={() => navigate('/agents/new')}
            className="flex items-center gap-2 bg-brand-gradient hover:opacity-90 text-white text-sm font-medium rounded-lg px-4 py-2 transition-[color,background-color,border-color,box-shadow,opacity] shadow-brand-sm hover:shadow-brand"
          >
            <Plus size={16} />
            New Agent
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : agents.length === 0 && pagination.totalItems === 0 ? (
        <div className="text-center py-16 text-zinc-600">
          <Bot size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-sm text-zinc-400 mb-1">No agents defined yet.</p>
          <p className="text-xs text-zinc-600 mb-6">Create a custom agent or generate examples from your MCP servers.</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleSeedExamples}
              disabled={seeding}
              className="flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.10] text-zinc-300 text-sm rounded-lg px-4 py-2.5 transition-colors border border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles size={15} className={seeding ? 'animate-pulse' : ''} />
              {seeding ? 'Creating...' : 'Create MCP Examples'}
            </button>
            <button
              onClick={() => navigate('/agents/new')}
              className="flex items-center gap-2 bg-brand-gradient hover:opacity-90 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-[color,background-color,border-color,box-shadow,opacity] shadow-brand-sm hover:shadow-brand"
            >
              <Plus size={16} />
              New Agent
            </button>
          </div>
        </div>
      ) : (
        <>
        <div className="space-y-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="card-item rounded-xl bg-[#111114] border border-white/[0.06] hover:border-white/[0.10] shadow-card transition-[color,background-color,border-color,box-shadow,opacity] duration-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-zinc-200">{agent.name}</h3>
                    <span className="bg-brand-gradient-subtle text-brand-blue text-[10px] font-medium px-2 py-0.5 rounded-md">
                      {agent.model}
                    </span>
                    {agent.mcp_server_ids?.length > 0 && (
                      <span className="flex items-center gap-1 bg-violet-500/10 text-violet-400 text-[10px] font-medium px-1.5 py-0.5 rounded-md border border-violet-500/20">
                        <Server size={9} />
                        {agent.mcp_server_ids.length} MCP
                      </span>
                    )}
                  </div>
                  {agent.description && (
                    <p className="text-xs text-zinc-500 mt-1">{agent.description}</p>
                  )}
                  {agent.allowed_tools?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {agent.allowed_tools.map((tool) => (
                        <span
                          key={tool}
                          className="bg-white/[0.04] text-zinc-500 text-[10px] px-1.5 py-0.5 rounded-md border border-white/[0.04]"
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
                    className="p-2 text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} totalItems={pagination.totalItems} onPageChange={goToPage} />
        </>
      )}
    </div>
  )
}
