import { create } from 'zustand'
import type { Agent, PaginatedResponse } from '../types'

interface AgentState {
  agents: Agent[]
  loading: boolean
  pagination: { page: number; totalPages: number; totalItems: number; pageSize: number }
  fetch: () => Promise<void>
  fetchPaginated: (page: number, pageSize?: number) => Promise<void>
  create: (a: Partial<Agent>) => Promise<Agent>
  update: (a: Agent) => Promise<void>
  remove: (id: string) => Promise<void>
  seedExamples: () => Promise<Agent[]>
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  loading: false,
  pagination: { page: 1, totalPages: 1, totalItems: 0, pageSize: 10 },
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
  fetchPaginated: async (page: number, pageSize = 10) => {
    set({ loading: true })
    try {
      const res = await window.go.main.App.ListAgentsPaginated(page, pageSize) as unknown as PaginatedResponse<Agent>
      set({
        agents: res.items || [],
        pagination: {
          page: res.page,
          totalPages: res.total_pages,
          totalItems: res.total_count,
          pageSize: res.page_size,
        },
      })
    } catch (e) {
      console.error('Failed to fetch agents:', e)
    } finally {
      set({ loading: false })
    }
  },
  create: async (a) => {
    const created = await window.go.main.App.CreateAgent(a as Agent)
    const { pagination } = get()
    get().fetchPaginated(pagination.page, pagination.pageSize)
    return created
  },
  update: async (a) => {
    await window.go.main.App.UpdateAgent(a)
    const { pagination } = get()
    get().fetchPaginated(pagination.page, pagination.pageSize)
  },
  remove: async (id) => {
    await window.go.main.App.DeleteAgent(id)
    const { pagination } = get()
    const newPage = pagination.totalItems - 1 <= (pagination.page - 1) * pagination.pageSize && pagination.page > 1
      ? pagination.page - 1
      : pagination.page
    get().fetchPaginated(newPage, pagination.pageSize)
  },
  seedExamples: async () => {
    const created = await window.go.main.App.SeedExampleAgents()
    get().fetchPaginated(1, get().pagination.pageSize)
    return created || []
  },
}))
