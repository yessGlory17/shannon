import { create } from 'zustand'
import type { Team } from '../types'

interface TeamState {
  teams: Team[]
  loading: boolean
  fetch: () => Promise<void>
  create: (t: Partial<Team>) => Promise<Team>
  update: (t: Team) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useTeamStore = create<TeamState>((set) => ({
  teams: [],
  loading: false,
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
  create: async (t) => {
    const created = await window.go.main.App.CreateTeam(t as Team)
    set((s) => ({ teams: [created, ...s.teams] }))
    return created
  },
  update: async (t) => {
    await window.go.main.App.UpdateTeam(t)
    set((s) => ({ teams: s.teams.map((x) => (x.id === t.id ? t : x)) }))
  },
  remove: async (id) => {
    await window.go.main.App.DeleteTeam(id)
    set((s) => ({ teams: s.teams.filter((x) => x.id !== id) }))
  },
}))
