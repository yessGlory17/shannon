import { create } from 'zustand'
import type { Agent } from '../types'

interface AgentState {
  agents: Agent[]
  loading: boolean
  fetch: () => Promise<void>
  create: (a: Partial<Agent>) => Promise<Agent>
  update: (a: Agent) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: [],
  loading: false,
  fetch: async () => {
    set({ loading: true })
    try {
      const agents = await window.go.main.App.ListAgents()
      set({ agents: agents || [] })
    } catch (e) {
      console.error('Failed to fetch agents:', e)
    } finally {
      set({ loading: false })
    }
  },
  create: async (a) => {
    const created = await window.go.main.App.CreateAgent(a as Agent)
    set((s) => ({ agents: [created, ...s.agents] }))
    return created
  },
  update: async (a) => {
    await window.go.main.App.UpdateAgent(a)
    set((s) => ({ agents: s.agents.map((x) => (x.id === a.id ? a : x)) }))
  },
  remove: async (id) => {
    await window.go.main.App.DeleteAgent(id)
    set((s) => ({ agents: s.agents.filter((x) => x.id !== id) }))
  },
}))
