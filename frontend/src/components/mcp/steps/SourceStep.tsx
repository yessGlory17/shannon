import { useState, useCallback, useRef, useEffect } from 'react'
import { Search, Package, ShieldCheck, Code, FileJson, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMCPStore } from '../../../stores/mcpStore'
import type { MCPWizardData, MCPCatalogItem } from '../../../types'

interface SourceStepProps {
  data: MCPWizardData
  onChange: (updates: Partial<MCPWizardData>) => void
}

type SourceMode = 'catalog' | 'custom' | 'json'

export function SourceStep({ data, onChange }: SourceStepProps) {
  const { catalog, catalogLoading, catalogTotal, catalogPage, catalogTotalPages, catalogQuery, searchCatalog } = useMCPStore()
  const [searchInput, setSearchInput] = useState('')
  const [jsonInput, setJsonInput] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [jsonParsing, setJsonParsing] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const { parseMCPJson } = useMCPStore()

  useEffect(() => {
    if (data.source === 'catalog' && catalog.length === 0) {
      searchCatalog('', 1)
    }
  }, [data.source, catalog.length, searchCatalog])

  const handleSearch = useCallback((value: string) => {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      searchCatalog(value, 1)
    }, 300)
  }, [searchCatalog])

  const selectSource = (mode: SourceMode) => {
    onChange({ source: mode, catalogItem: undefined })
  }

  const selectCatalogItem = (item: MCPCatalogItem) => {
    onChange({
      source: 'catalog',
      catalogItem: item,
      name: item.displayName || item.qualifiedName,
      server_key: item.qualifiedName,
      description: item.description,
    })
  }

  const handleJsonParse = async () => {
    if (!jsonInput.trim()) return
    setJsonError('')
    setJsonParsing(true)
    try {
      const entries = await parseMCPJson(jsonInput)
      if (entries && entries.length > 0) {
        const first = entries[0]
        onChange({
          source: 'json',
          name: first.serverKey,
          server_key: first.serverKey,
          command: first.command,
          args: first.args || [],
          env: first.env || {},
        })
      }
    } catch (e: any) {
      setJsonError(e?.message || 'Failed to parse JSON')
    } finally {
      setJsonParsing(false)
    }
  }

  const formatUseCount = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
  }

  return (
    <div className="space-y-4">
      {/* Source selection cards */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { mode: 'catalog' as SourceMode, icon: Package, label: 'Browse Catalog', desc: 'Search the Smithery registry' },
          { mode: 'custom' as SourceMode, icon: Code, label: 'Custom Server', desc: 'Enter configuration manually' },
          { mode: 'json' as SourceMode, icon: FileJson, label: 'Import JSON', desc: 'Paste .mcp.json config' },
        ]).map(({ mode, icon: Icon, label, desc }) => (
          <button
            key={mode}
            onClick={() => selectSource(mode)}
            className={`p-4 rounded-xl border text-left transition-colors ${
              data.source === mode
                ? 'border-blue-500/40 bg-blue-600/10'
                : 'border-white/[0.06] bg-[#111114] hover:border-white/[0.12]'
            }`}
          >
            <Icon size={20} className={data.source === mode ? 'text-blue-400 mb-2' : 'text-zinc-500 mb-2'} />
            <div className={`text-sm font-medium ${data.source === mode ? 'text-blue-300' : 'text-zinc-300'}`}>
              {label}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">{desc}</div>
          </button>
        ))}
      </div>

      {/* Catalog browse */}
      {data.source === 'catalog' && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search MCP servers..."
              className="w-full pl-9 pr-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 input-focus transition-colors"
            />
          </div>

          <p className="text-xs text-zinc-500">
            {catalogLoading ? 'Searching...' : (
              <>
                {catalogTotal.toLocaleString()} servers
                {catalogQuery && <> matching &ldquo;{catalogQuery}&rdquo;</>}
              </>
            )}
          </p>

          {catalogLoading && catalog.length === 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3">
                  <div className="h-4 bg-white/[0.06] rounded w-24 mb-2" />
                  <div className="h-3 bg-white/[0.04] rounded w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
              {catalog.map((item) => (
                <button
                  key={item.id}
                  onClick={() => selectCatalogItem(item)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    data.catalogItem?.qualifiedName === item.qualifiedName
                      ? 'border-blue-500/40 bg-blue-600/10'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {item.iconUrl ? (
                      <img src={item.iconUrl} alt="" className="w-5 h-5 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    ) : (
                      <Package size={14} className="text-zinc-500" />
                    )}
                    <span className="text-xs font-medium text-zinc-200 truncate">{item.displayName}</span>
                    {item.verified && <ShieldCheck size={11} className="text-blue-400 flex-shrink-0" />}
                  </div>
                  <p className="text-[11px] text-zinc-500 line-clamp-2">{item.description}</p>
                  {item.useCount > 0 && (
                    <span className="text-[10px] text-zinc-600 mt-1 inline-block">{formatUseCount(item.useCount)} uses</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {catalogTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => searchCatalog(catalogQuery, catalogPage - 1)}
                disabled={catalogPage <= 1}
                className="p-1 rounded text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs text-zinc-500">
                Page {catalogPage} of {catalogTotalPages}
              </span>
              <button
                onClick={() => searchCatalog(catalogQuery, catalogPage + 1)}
                disabled={catalogPage >= catalogTotalPages}
                className="p-1 rounded text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {data.catalogItem && (
            <div className="p-3 rounded-lg bg-emerald-600/10 border border-emerald-600/20 text-xs text-emerald-300">
              Selected: <span className="font-medium">{data.catalogItem.displayName}</span>
            </div>
          )}
        </div>
      )}

      {/* Custom server hint */}
      {data.source === 'custom' && (
        <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs text-zinc-400">
          You&apos;ll configure the server command, arguments, and environment variables in the next step.
        </div>
      )}

      {/* JSON import */}
      {data.source === 'json' && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">
            Paste a <code className="px-1 py-0.5 bg-white/[0.06] rounded text-zinc-400">.mcp.json</code> configuration:
          </p>
          <textarea
            value={jsonInput}
            onChange={(e) => { setJsonInput(e.target.value); setJsonError('') }}
            placeholder={'{\n  "mcpServers": {\n    "server-name": {\n      "command": "npx",\n      "args": ["-y", "@scope/server"],\n      "env": {}\n    }\n  }\n}'}
            rows={8}
            className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 input-focus transition-colors font-mono resize-none"
          />
          {jsonError && (
            <p className="text-xs text-red-400">{jsonError}</p>
          )}
          <button
            onClick={handleJsonParse}
            disabled={!jsonInput.trim() || jsonParsing}
            className="px-4 py-2 bg-brand-gradient hover:opacity-90 text-white text-sm font-medium rounded-lg transition-colors shadow-brand-sm disabled:opacity-50"
          >
            {jsonParsing ? 'Parsing...' : 'Parse JSON'}
          </button>
          {data.command && data.source === 'json' && (
            <div className="p-3 rounded-lg bg-emerald-600/10 border border-emerald-600/20 text-xs text-emerald-300">
              Parsed: <span className="font-medium">{data.server_key}</span> ({data.command} {(data.args || []).join(' ')})
            </div>
          )}
        </div>
      )}
    </div>
  )
}
