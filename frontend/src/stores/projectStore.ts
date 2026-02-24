import { create } from 'zustand'
import type { Project } from '../types'

interface ProjectState {
  projects: Project[]
  loading: boolean
  fetch: () => Promise<void>
  create: (p: Partial<Project>) => Promise<Project>
  update: (p: Project) => Promise<void>
  remove: (id: string) => Promise<void>
  selectFolder: () => Promise<string>
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  loading: false,
  fetch: async () => {
    set({ loading: true })
    try {
      const projects = await window.go.main.App.ListProjects()
      set({ projects: projects || [] })
    } catch (e) {
      console.error('Failed to fetch projects:', e)
    } finally {
      set({ loading: false })
    }
  },
  create: async (p) => {
    const created = await window.go.main.App.CreateProject(p as Project)
    set((s) => ({ projects: [created, ...s.projects] }))
    return created
  },
  update: async (p) => {
    await window.go.main.App.UpdateProject(p)
    set((s) => ({ projects: s.projects.map((x) => (x.id === p.id ? p : x)) }))
  },
  remove: async (id) => {
    await window.go.main.App.DeleteProject(id)
    set((s) => ({ projects: s.projects.filter((x) => x.id !== id) }))
  },
  selectFolder: async () => {
    return window.go.main.App.SelectProjectFolder()
  },
}))
