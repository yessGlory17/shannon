import { create } from 'zustand'
import type { MCPServer, MCPCatalogItem, MCPCatalogResponse, MCPInstallConfig } from '../types'

interface MCPState {
  // Installed servers
  servers: MCPServer[]
  loading: boolean
  fetch: () => Promise<void>
  create: (s: Partial<MCPServer>) => Promise<MCPServer>
  update: (s: MCPServer) => Promise<void>
  remove: (id: string) => Promise<void>

  // Catalog (Smithery Registry)
  catalog: MCPCatalogItem[]
  catalogLoading: boolean
  catalogTotal: number
  catalogPage: number
  catalogTotalPages: number
  catalogQuery: string
  searchCatalog: (query: string, page?: number) => Promise<void>
  getInstallConfig: (qualifiedName: string) => Promise<MCPInstallConfig>
}

export const useMCPStore = create<MCPState>((set, get) => ({
  // Installed servers
  servers: [],
  loading: false,
  fetch: async () => {
    set({ loading: true })
    try {
      const servers = await window.go.main.App.ListMCPServers()
      set({ servers: servers || [] })
    } catch (e) {
      console.error('Failed to fetch MCP servers:', e)
    } finally {
      set({ loading: false })
    }
  },
  create: async (s) => {
    const created = await window.go.main.App.CreateMCPServer(s as MCPServer)
    set((state) => ({ servers: [created, ...state.servers] }))
    return created
  },
  update: async (s) => {
    await window.go.main.App.UpdateMCPServer(s)
    set((state) => ({ servers: state.servers.map((x) => (x.id === s.id ? s : x)) }))
  },
  remove: async (id) => {
    await window.go.main.App.DeleteMCPServer(id)
    set((state) => ({ servers: state.servers.filter((x) => x.id !== id) }))
  },

  // Catalog
  catalog: [],
  catalogLoading: false,
  catalogTotal: 0,
  catalogPage: 1,
  catalogTotalPages: 0,
  catalogQuery: '',
  searchCatalog: async (query: string, page = 1) => {
    set({ catalogLoading: true, catalogQuery: query })
    try {
      const resp: MCPCatalogResponse = await window.go.main.App.SearchMCPCatalog(query, page)
      set({
        catalog: resp.servers || [],
        catalogTotal: resp.totalCount,
        catalogPage: resp.page,
        catalogTotalPages: resp.totalPages,
      })
    } catch (e) {
      console.error('Failed to search MCP catalog:', e)
      set({ catalog: [] })
    } finally {
      set({ catalogLoading: false })
    }
  },
  getInstallConfig: async (qualifiedName: string) => {
    return await window.go.main.App.GetMCPInstallConfig(qualifiedName)
  },
}))
