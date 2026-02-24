import { useEffect, useState } from 'react'
import { Plus, Trash2, Users, Pencil, X } from 'lucide-react'
import { useTeamStore } from '../stores/teamStore'
import { useAgentStore } from '../stores/agentStore'
import type { Team } from '../types'

const STRATEGIES = [
  { value: 'parallel', label: 'Parallel', desc: 'All agents work simultaneously' },
  { value: 'sequential', label: 'Sequential', desc: 'Agents work one after another' },
  { value: 'planner', label: 'Planner', desc: 'AI decomposes tasks and assigns' },
]

export function TeamManager() {
  const { teams, loading, fetch, create, update, remove } = useTeamStore()
  const { agents, fetch: fetchAgents } = useAgentStore()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', agent_ids: [] as string[], strategy: 'parallel' })

  useEffect(() => {
    fetch()
    fetchAgents()
  }, [fetch, fetchAgents])

  const handleSave = async () => {
    if (!form.name) return
    if (editingId) {
      await update({ ...form, id: editingId } as unknown as Team)
    } else {
      await create(form as unknown as Partial<Team>)
    }
    setForm({ name: '', description: '', agent_ids: [], strategy: 'parallel' })
    setShowForm(false)
    setEditingId(null)
  }

  const handleEdit = (team: Team) => {
    setForm({
      name: team.name,
      description: team.description,
      agent_ids: team.agent_ids || [],
      strategy: team.strategy,
    })
    setEditingId(team.id)
    setShowForm(true)
  }

  const toggleAgent = (agentId: string) => {
    setForm((f) => ({
      ...f,
      agent_ids: f.agent_ids.includes(agentId)
        ? f.agent_ids.filter((id) => id !== agentId)
        : [...f.agent_ids, agentId],
    }))
  }

  const getAgentName = (id: string) => agents.find((a) => a.id === id)?.name || id.slice(0, 8)

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Teams</h1>
        <button
          onClick={() => {
            setForm({ name: '', description: '', agent_ids: [], strategy: 'parallel' })
            setEditingId(null)
            setShowForm(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-md transition-colors"
        >
          <Plus size={16} />
          New Team
        </button>
      </div>

      {showForm && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-zinc-300">
              {editingId ? 'Edit Team' : 'New Team'}
            </h2>
            <button onClick={() => setShowForm(false)} className="text-zinc-500 hover:text-zinc-300">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Backend Team"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Handles API and database tasks"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Strategy</label>
              <div className="space-y-1.5">
                {STRATEGIES.map((s) => (
                  <label
                    key={s.value}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                      form.strategy === s.value
                        ? 'bg-purple-600/10 border border-purple-600/30'
                        : 'bg-zinc-800 border border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="strategy"
                      value={s.value}
                      checked={form.strategy === s.value}
                      onChange={(e) => setForm((f) => ({ ...f, strategy: e.target.value }))}
                      className="accent-purple-500"
                    />
                    <div>
                      <span className="text-sm text-zinc-200">{s.label}</span>
                      <p className="text-xs text-zinc-500">{s.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Agents</label>
              {agents.length === 0 ? (
                <p className="text-xs text-zinc-600">No agents available. Create agents first.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => toggleAgent(agent.id)}
                      className={`px-2.5 py-1 rounded text-xs transition-colors ${
                        form.agent_ids.includes(agent.id)
                          ? 'bg-purple-600/20 text-purple-400 border border-purple-600/40'
                          : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      {agent.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-md"
              >
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : teams.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <Users size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">No teams yet. Create one to organize your agents.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {teams.map((team) => (
            <div
              key={team.id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-zinc-200">{team.name}</h3>
                    <span className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">
                      {team.strategy}
                    </span>
                  </div>
                  {team.description && (
                    <p className="text-xs text-zinc-500 mt-1">{team.description}</p>
                  )}
                  {team.agent_ids?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {team.agent_ids.map((id) => (
                        <span
                          key={id}
                          className="px-1.5 py-0.5 bg-zinc-800/80 rounded text-xs text-zinc-500"
                        >
                          {getAgentName(id)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 ml-3">
                  <button
                    onClick={() => handleEdit(team)}
                    className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => remove(team.id)}
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
