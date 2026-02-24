import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Plus, Trash2, Pencil, Server, X, Check, Search,
  ToggleLeft, ToggleRight, ChevronDown, ChevronRight,
  ChevronLeft, Download, ShieldCheck,
  Package, AlertTriangle,
} from 'lucide-react'
import { useMCPStore } from '../stores/mcpStore'
import type { MCPServer, MCPCatalogItem, MCPInstallConfig } from '../types'

type Tab = 'browse' | 'installed'

export function MCPServers() {
  const {
    servers, loading, fetch,
    create, update, remove,
    catalog, catalogLoading, catalogTotal, catalogPage, catalogTotalPages, catalogQuery,
    searchCatalog, getInstallConfig,
  } = useMCPStore()

  const [activeTab, setActiveTab] = useState<Tab>('browse')
  const [searchInput, setSearchInput] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Install modal
  const [installTarget, setInstallTarget] = useState<MCPCatalogItem | null>(null)
  const [installConfig, setInstallConfig] = useState<MCPInstallConfig | null>(null)
  const [installEnv, setInstallEnv] = useState<Record<string, string>>({})
  const [installLoading, setInstallLoading] = useState(false)

  // Configure modal
  const [configTarget, setConfigTarget] = useState<MCPServer | null>(null)
  const [configEnv, setConfigEnv] = useState<{ key: string; value: string }[]>([])
  const [configCommand, setConfigCommand] = useState('')
  const [configArgs, setConfigArgs] = useState('')

  // Custom server form
  const [showCustom, setShowCustom] = useState(false)
  const [customForm, setCustomForm] = useState({ name: '', server_key: '', description: '', command: '', args: '', env: [] as { key: string; value: string }[] })

  // Expanded installed servers
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch()
    searchCatalog('', 1)
  }, [fetch, searchCatalog])

  const handleSearch = useCallback((value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      searchCatalog(value, 1)
    }, 300)
  }, [searchCatalog])

  // Check if a catalog item is already installed
  const isInstalled = (qualifiedName: string) => {
    return servers.some((s) => s.server_key === qualifiedName || s.name === qualifiedName)
  }

  // Open install modal
  const openInstall = async (item: MCPCatalogItem) => {
    setInstallTarget(item)
    setInstallLoading(true)
    try {
      const config = await getInstallConfig(item.qualifiedName)
      setInstallConfig(config)
      const envDefaults: Record<string, string> = {}
      if (config.envVars) {
        for (const v of config.envVars) {
          envDefaults[v.name] = ''
        }
      }
      setInstallEnv(envDefaults)
    } catch {
      setInstallConfig({ command: 'npx', args: ['-y', item.qualifiedName], envVars: [] })
      setInstallEnv({})
    } finally {
      setInstallLoading(false)
    }
  }

  const doInstall = async () => {
    if (!installTarget || !installConfig) return
    const env: Record<string, string> = {}
    for (const [k, v] of Object.entries(installEnv)) {
      if (v.trim()) env[k] = v.trim()
    }
    await create({
      name: installTarget.displayName || installTarget.qualifiedName,
      server_key: installTarget.qualifiedName,
      description: installTarget.description,
      command: installConfig.command,
      args: installConfig.args,
      env,
      enabled: true,
    })
    setInstallTarget(null)
    setInstallConfig(null)
    setInstallEnv({})
  }

  // Configure modal
  const openConfigure = (server: MCPServer) => {
    setConfigTarget(server)
    setConfigCommand(server.command)
    setConfigArgs((server.args || []).join('\n'))
    setConfigEnv(
      Object.entries(server.env || {}).map(([key, value]) => ({ key, value }))
    )
  }

  const doSaveConfigure = async () => {
    if (!configTarget) return
    const env: Record<string, string> = {}
    for (const e of configEnv) {
      if (e.key.trim()) env[e.key.trim()] = e.value
    }
    const args = configArgs.split('\n').map((s) => s.trim()).filter(Boolean)
    await update({ ...configTarget, command: configCommand, args, env })
    setConfigTarget(null)
  }

  // Custom server
  const doCreateCustom = async () => {
    if (!customForm.name.trim() || !customForm.server_key.trim() || !customForm.command.trim()) return
    const env: Record<string, string> = {}
    for (const e of customForm.env) {
      if (e.key.trim()) env[e.key.trim()] = e.value
    }
    const args = customForm.args.split('\n').map((s) => s.trim()).filter(Boolean)
    await create({
      name: customForm.name,
      server_key: customForm.server_key,
      description: customForm.description,
      command: customForm.command,
      args,
      env,
      enabled: true,
    })
    setCustomForm({ name: '', server_key: '', description: '', command: '', args: '', env: [] })
    setShowCustom(false)
  }

  const toggleExpanded = (id: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const formatUseCount = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">MCP Servers</h1>
        <p className="text-xs text-zinc-500 mt-1">
          Browse and install MCP servers for your agents
        </p>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-1 bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'browse'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Browse
          </button>
          <button
            onClick={() => setActiveTab('installed')}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'installed'
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Installed
            {servers.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-zinc-700 rounded text-xs">
                {servers.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'browse' && (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search servers..."
              className="pl-9 pr-3 py-1.5 w-64 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
            />
          </div>
        )}
      </div>

      {/* Browse Tab */}
      {activeTab === 'browse' && (
        <div>
          {/* Catalog info */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-zinc-500">
              {catalogLoading ? 'Searching...' : (
                <>
                  {catalogTotal.toLocaleString()} servers from{' '}
                  <span className="text-zinc-400">Smithery Registry</span>
                  {catalogQuery && <> matching &ldquo;{catalogQuery}&rdquo;</>}
                </>
              )}
            </p>
          </div>

          {/* Grid */}
          {catalogLoading && catalog.length === 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 animate-pulse">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-zinc-800 rounded-lg" />
                    <div className="flex-1">
                      <div className="h-4 bg-zinc-800 rounded w-24 mb-1" />
                      <div className="h-3 bg-zinc-800 rounded w-16" />
                    </div>
                  </div>
                  <div className="h-3 bg-zinc-800 rounded w-full mb-1" />
                  <div className="h-3 bg-zinc-800 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {catalog.map((item) => (
                <CatalogCard
                  key={item.id}
                  item={item}
                  installed={isInstalled(item.qualifiedName)}
                  onInstall={() => openInstall(item)}
                  formatUseCount={formatUseCount}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {catalogTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => searchCatalog(catalogQuery, catalogPage - 1)}
                disabled={catalogPage <= 1}
                className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex gap-1">
                {paginationRange(catalogPage, catalogTotalPages).map((p, i) => (
                  p === '...' ? (
                    <span key={`dots-${i}`} className="px-2 py-1 text-xs text-zinc-600">...</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => searchCatalog(catalogQuery, p as number)}
                      className={`px-2.5 py-1 rounded text-xs transition-colors ${
                        p === catalogPage
                          ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/40'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      }`}
                    >
                      {p}
                    </button>
                  )
                ))}
              </div>
              <button
                onClick={() => searchCatalog(catalogQuery, catalogPage + 1)}
                disabled={catalogPage >= catalogTotalPages}
                className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Installed Tab */}
      {activeTab === 'installed' && (
        <div>
          {loading ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : servers.length === 0 && !showCustom ? (
            <div className="text-center py-12 text-zinc-500">
              <Server size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No MCP servers installed yet.</p>
              <p className="text-xs mt-1 text-zinc-600">Browse the catalog to install servers, or add a custom one.</p>
              <div className="flex justify-center gap-2 mt-4">
                <button
                  onClick={() => setActiveTab('browse')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-md transition-colors"
                >
                  Browse Catalog
                </button>
                <button
                  onClick={() => setShowCustom(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors"
                >
                  <Plus size={14} />
                  Add Custom
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {servers.map((server) => (
                <InstalledCard
                  key={server.id}
                  server={server}
                  expanded={expandedServers.has(server.id)}
                  onToggleExpand={() => toggleExpanded(server.id)}
                  onToggleEnabled={() => update({ ...server, enabled: !server.enabled })}
                  onConfigure={() => openConfigure(server)}
                  onRemove={() => remove(server.id)}
                />
              ))}

              {!showCustom && (
                <button
                  onClick={() => setShowCustom(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-zinc-700 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors"
                >
                  <Plus size={14} />
                  Add Custom Server
                </button>
              )}
            </div>
          )}

          {/* Custom server form */}
          {showCustom && (
            <CustomServerForm
              form={customForm}
              onChange={setCustomForm}
              onSave={doCreateCustom}
              onCancel={() => { setShowCustom(false); setCustomForm({ name: '', server_key: '', description: '', command: '', args: '', env: [] }) }}
            />
          )}
        </div>
      )}

      {/* Install Modal */}
      {installTarget && (
        <Modal onClose={() => { setInstallTarget(null); setInstallConfig(null) }}>
          <div className="flex items-center gap-3 mb-4">
            {installTarget.iconUrl ? (
              <img src={installTarget.iconUrl} alt="" className="w-10 h-10 rounded-lg bg-zinc-800 object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center">
                <Package size={20} className="text-zinc-500" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-zinc-100">Install {installTarget.displayName}</h3>
              <p className="text-xs text-zinc-500">{installTarget.qualifiedName}</p>
            </div>
          </div>

          {installLoading ? (
            <div className="py-8 text-center text-sm text-zinc-500">Loading configuration...</div>
          ) : installConfig ? (
            <div className="space-y-4">
              {/* Command preview */}
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Command</label>
                <div className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-xs font-mono text-zinc-300">
                  {installConfig.command} {installConfig.args.join(' ')}
                </div>
              </div>

              {/* Env vars */}
              {installConfig.envVars && installConfig.envVars.length > 0 && (
                <div>
                  <label className="block text-xs text-zinc-500 mb-2">Configuration</label>
                  <div className="space-y-3">
                    {installConfig.envVars.map((v) => (
                      <div key={v.name}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <label className="text-xs font-mono text-zinc-300">{v.name}</label>
                          {v.required && <span className="text-red-400 text-xs">*</span>}
                        </div>
                        <input
                          type="text"
                          value={installEnv[v.name] || ''}
                          onChange={(e) => setInstallEnv((prev) => ({ ...prev, [v.name]: e.target.value }))}
                          placeholder={v.placeholder || v.description}
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
                        />
                        {v.description && (
                          <p className="text-xs text-zinc-600 mt-0.5">{v.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!installConfig.envVars || installConfig.envVars.length === 0) && (
                <p className="text-xs text-zinc-500 py-2">No additional configuration required.</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => { setInstallTarget(null); setInstallConfig(null) }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={doInstall}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-md transition-colors"
                >
                  <Download size={14} />
                  Install & Enable
                </button>
              </div>
            </div>
          ) : null}
        </Modal>
      )}

      {/* Configure Modal */}
      {configTarget && (
        <Modal onClose={() => setConfigTarget(null)}>
          <h3 className="text-sm font-medium text-zinc-100 mb-4">
            Configure {configTarget.name}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Command</label>
              <input
                type="text"
                value={configCommand}
                onChange={(e) => setConfigCommand(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Arguments (one per line)</label>
              <textarea
                value={configArgs}
                onChange={(e) => setConfigArgs(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 font-mono resize-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-400">Environment Variables</label>
                <button
                  onClick={() => setConfigEnv((prev) => [...prev, { key: '', value: '' }])}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
                >
                  <Plus size={10} />
                  Add
                </button>
              </div>
              {configEnv.length === 0 ? (
                <p className="text-xs text-zinc-600 py-2">No environment variables</p>
              ) : (
                <div className="space-y-2">
                  {configEnv.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={entry.key}
                        onChange={(e) => setConfigEnv((prev) => prev.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                        placeholder="KEY"
                        className="w-1/3 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
                      />
                      <span className="text-zinc-600 text-xs">=</span>
                      <input
                        type="text"
                        value={entry.value}
                        onChange={(e) => setConfigEnv((prev) => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                        placeholder="value"
                        className="flex-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
                      />
                      <button
                        onClick={() => setConfigEnv((prev) => prev.filter((_, j) => j !== i))}
                        className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfigTarget(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={doSaveConfigure}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-md transition-colors"
              >
                <Check size={14} />
                Save
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────

function CatalogCard({
  item,
  installed,
  onInstall,
  formatUseCount,
}: {
  item: MCPCatalogItem
  installed: boolean
  onInstall: () => void
  formatUseCount: (n: number) => string
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col hover:border-zinc-700 transition-colors">
      <div className="flex items-start gap-3 mb-3">
        {item.iconUrl ? (
          <img
            src={item.iconUrl}
            alt=""
            className="w-10 h-10 rounded-lg bg-zinc-800 object-cover flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
            <Package size={20} className="text-zinc-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-medium text-zinc-200 truncate">{item.displayName}</h3>
            {item.verified && (
              <ShieldCheck size={13} className="text-blue-400 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-zinc-600 truncate font-mono">{item.qualifiedName}</p>
        </div>
      </div>

      <p className="text-xs text-zinc-400 line-clamp-2 flex-1 mb-3">
        {item.description || 'No description available'}
      </p>

      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2">
          {item.useCount > 0 && (
            <span className="text-xs text-zinc-600">
              {formatUseCount(item.useCount)} uses
            </span>
          )}
          {item.verified && (
            <span className="px-1.5 py-0.5 bg-blue-600/10 text-blue-400 rounded text-[10px]">Verified</span>
          )}
        </div>

        {installed ? (
          <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/10 text-emerald-400 rounded text-xs border border-emerald-600/20">
            <Check size={12} />
            Installed
          </span>
        ) : (
          <button
            onClick={onInstall}
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs transition-colors"
          >
            <Download size={12} />
            Install
          </button>
        )}
      </div>
    </div>
  )
}

function InstalledCard({
  server,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  onConfigure,
  onRemove,
}: {
  server: MCPServer
  expanded: boolean
  onToggleExpand: () => void
  onToggleEnabled: () => void
  onConfigure: () => void
  onRemove: () => void
}) {
  const hasEmptyRequiredEnv = server.env && Object.values(server.env).some((v) => !v)

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={onToggleExpand}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              server.enabled
                ? hasEmptyRequiredEnv ? 'bg-yellow-400' : 'bg-emerald-400'
                : 'bg-zinc-600'
            }`}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-zinc-200">{server.name}</h3>
              <span className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs text-zinc-500 font-mono">
                {server.server_key}
              </span>
              {hasEmptyRequiredEnv && (
                <span className="flex items-center gap-1 text-xs text-yellow-400">
                  <AlertTriangle size={11} />
                  Setup needed
                </span>
              )}
            </div>
            {server.description && (
              <p className="text-xs text-zinc-500 mt-0.5 truncate">{server.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-3">
          <button
            onClick={onToggleEnabled}
            className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            title={server.enabled ? 'Disable' : 'Enable'}
          >
            {server.enabled ? (
              <ToggleRight size={16} className="text-emerald-400" />
            ) : (
              <ToggleLeft size={16} />
            )}
          </button>
          <button
            onClick={onConfigure}
            className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Configure"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onRemove}
            className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
            title="Uninstall"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-zinc-800 mt-0">
          <div className="grid grid-cols-2 gap-4 pt-3">
            <div>
              <span className="text-xs text-zinc-500">Command</span>
              <p className="text-xs font-mono text-zinc-300 mt-0.5">{server.command}</p>
            </div>
            <div>
              <span className="text-xs text-zinc-500">Arguments</span>
              <p className="text-xs font-mono text-zinc-300 mt-0.5">
                {(server.args || []).join(' ') || '-'}
              </p>
            </div>
          </div>
          {server.env && Object.keys(server.env).length > 0 && (
            <div className="mt-3">
              <span className="text-xs text-zinc-500">Environment Variables</span>
              <div className="mt-1 space-y-1">
                {Object.entries(server.env).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-400">{key}</span>
                    <span className="text-xs text-zinc-600">=</span>
                    <span className="text-xs font-mono text-zinc-500">
                      {value ? '***' : '(empty)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-lg p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  )
}

function CustomServerForm({
  form,
  onChange,
  onSave,
  onCancel,
}: {
  form: { name: string; server_key: string; description: string; command: string; args: string; env: { key: string; value: string }[] }
  onChange: (f: typeof form) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 mt-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-zinc-200">Add Custom Server</h2>
        <button onClick={onCancel} className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Display Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            placeholder="e.g., My Server"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Server Key *</label>
          <input
            type="text"
            value={form.server_key}
            onChange={(e) => onChange({ ...form, server_key: e.target.value })}
            placeholder="e.g., my-server"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs text-zinc-400 mb-1">Description</label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          placeholder="What this server provides..."
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
        />
      </div>

      <div className="mb-4">
        <label className="block text-xs text-zinc-400 mb-1">Command *</label>
        <input
          type="text"
          value={form.command}
          onChange={(e) => onChange({ ...form, command: e.target.value })}
          placeholder="e.g., npx, uvx, node"
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
        />
      </div>

      <div className="mb-4">
        <label className="block text-xs text-zinc-400 mb-1">Arguments (one per line)</label>
        <textarea
          value={form.args}
          onChange={(e) => onChange({ ...form, args: e.target.value })}
          placeholder={'-y\n@some/mcp-server'}
          rows={3}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono resize-none"
        />
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-zinc-400">Environment Variables</label>
          <button
            onClick={() => onChange({ ...form, env: [...form.env, { key: '', value: '' }] })}
            className="flex items-center gap-1 px-2 py-0.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
          >
            <Plus size={10} />
            Add
          </button>
        </div>
        {form.env.length === 0 ? (
          <p className="text-xs text-zinc-600 py-2">No environment variables</p>
        ) : (
          <div className="space-y-2">
            {form.env.map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={entry.key}
                  onChange={(e) => {
                    const env = [...form.env]
                    env[i] = { ...env[i], key: e.target.value }
                    onChange({ ...form, env })
                  }}
                  placeholder="KEY"
                  className="w-1/3 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
                />
                <span className="text-zinc-600 text-xs">=</span>
                <input
                  type="text"
                  value={entry.value}
                  onChange={(e) => {
                    const env = [...form.env]
                    env[i] = { ...env[i], value: e.target.value }
                    onChange({ ...form, env })
                  }}
                  placeholder="value"
                  className="flex-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
                />
                <button
                  onClick={() => onChange({ ...form, env: form.env.filter((_, j) => j !== i) })}
                  className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!form.name.trim() || !form.server_key.trim() || !form.command.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check size={14} />
          Create
        </button>
      </div>
    </div>
  )
}

// Pagination helper
function paginationRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i)
  }
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}
