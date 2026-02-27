import { create } from 'zustand'
import type { Team, PaginatedResponse } from '../types'

interface TeamState {
  teams: Team[]
  loading: boolean
  pagination: { page: number; totalPages: number; totalItems: number; pageSize: number }
  fetch: () => Promise<void>
  fetchPaginated: (page: number, pageSize?: number) => Promise<void>
  create: (t: Partial<Team>) => Promise<Team>
  update: (t: Team) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useTeamStore = create<TeamState>((set, get) => ({
  teams: [],
  loading: false,
  pagination: { page: 1, totalPages: 1, totalItems: 0, pageSize: 10 },
  fetch: async () => {
    set({ loading: true })
    try {
      const teams = await window.go.main.App.ListTeams()
      set({ teams: teams || [] })
    } catch (e) {
      console.error('Failed to fetch teams:', e)
    } finally {
      set({ loading: false })
    }
  },
  fetchPaginated: async (page: number, pageSize = 10) => {
    set({ loading: true })
    try {
      const res = await window.go.main.App.ListTeamsPaginated(page, pageSize) as unknown as PaginatedResponse<Team>
      set({
        teams: res.items || [],
        pagination: {
          page: res.page,
          totalPages: res.total_pages,
          totalItems: res.total_count,
          pageSize: res.page_size,
        },
      })
    } catch (e) {
      console.error('Failed to fetch teams:', e)
    } finally {
      set({ loading: false })
    }
  },
  create: async (t) => {
    const created = await window.go.main.App.CreateTeam(t as Team)
    const { pagination } = get()
    get().fetchPaginated(pagination.page, pagination.pageSize)
    return created
  },
  update: async (t) => {
    await window.go.main.App.UpdateTeam(t)
    const { pagination } = get()
    get().fetchPaginated(pagination.page, pagination.pageSize)
  },
  remove: async (id) => {
    await window.go.main.App.DeleteTeam(id)
    const { pagination } = get()
    const newPage = pagination.totalItems - 1 <= (pagination.page - 1) * pagination.pageSize && pagination.page > 1
      ? pagination.page - 1
      : pagination.page
    get().fetchPaginated(newPage, pagination.pageSize)
  },
}))
