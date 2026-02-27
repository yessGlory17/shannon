import { create } from 'zustand'
import type { Project, PaginatedResponse } from '../types'

interface ProjectState {
  projects: Project[]
  loading: boolean
  pagination: { page: number; totalPages: number; totalItems: number; pageSize: number }
  fetch: () => Promise<void>
  fetchPaginated: (page: number, pageSize?: number) => Promise<void>
  create: (p: Partial<Project>) => Promise<Project>
  update: (p: Project) => Promise<void>
  remove: (id: string) => Promise<void>
  selectFolder: () => Promise<string>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  loading: false,
  pagination: { page: 1, totalPages: 1, totalItems: 0, pageSize: 10 },
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
  fetchPaginated: async (page: number, pageSize = 10) => {
    set({ loading: true })
    try {
      const res = await window.go.main.App.ListProjectsPaginated(page, pageSize) as unknown as PaginatedResponse<Project>
      set({
        projects: res.items || [],
        pagination: {
          page: res.page,
          totalPages: res.total_pages,
          totalItems: res.total_count,
          pageSize: res.page_size,
        },
      })
    } catch (e) {
      console.error('Failed to fetch projects:', e)
    } finally {
      set({ loading: false })
    }
  },
  create: async (p) => {
    const created = await window.go.main.App.CreateProject(p as Project)
    const { pagination } = get()
    get().fetchPaginated(pagination.page, pagination.pageSize)
    return created
  },
  update: async (p) => {
    await window.go.main.App.UpdateProject(p)
    const { pagination } = get()
    get().fetchPaginated(pagination.page, pagination.pageSize)
  },
  remove: async (id) => {
    await window.go.main.App.DeleteProject(id)
    const { pagination } = get()
    const newPage = pagination.totalItems - 1 <= (pagination.page - 1) * pagination.pageSize && pagination.page > 1
      ? pagination.page - 1
      : pagination.page
    get().fetchPaginated(newPage, pagination.pageSize)
  },
  selectFolder: async () => {
    return window.go.main.App.SelectProjectFolder()
  },
}))
