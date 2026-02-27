import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Save, RotateCcw, Copy, Check, AlertTriangle,
  Server, FileJson, Activity, Download,
} from 'lucide-react'
import { useMCPStore } from '../stores/mcpStore'

const PLACEHOLDER_JSON = `{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxx"
      }
    }
  }
}`

type SyncStatus = 'idle' | 'saving' | 'saved' | 'error'
type TestStatus = 'idle' | 'testing' | 'done'

interface ServerTestResult {
  success: boolean
  serverName?: string
  version?: string
  error?: string
  durationMs: number
}

export function MCPServers() {
  const { servers, loading, fetch, syncFromJson, exportJson, testServer, importFromClaude } = useMCPStore()

  const [jsonValue, setJsonValue] = useState('')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncError, setSyncError] = useState('')
  const [parseError, setParseError] = useState('')
  const [copied, setCopied] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [lastSavedJson, setLastSavedJson] = useState('')

  // Health check state
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testResults, setTestResults] = useState<Record<string, ServerTestResult>>({})

  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'done' | 'error'>('idle')
  const [importError, setImportError] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load current config from DB on mount
  useEffect(() => {
    fetch()
  }, [fetch])

  // When servers load, export to JSON for the editor
  useEffect(() => {
    if (!loading && servers !== undefined) {
      exportJson().then((json) => {
        // If editor is empty or matches last saved, update it
        if (!jsonValue || jsonValue === lastSavedJson) {
          setJsonValue(json)
          setLastSavedJson(json)
          setHasChanges(false)
        }
      }).catch(console.error)
    }
  }, [servers, loading])

  // Validate JSON as user types
  useEffect(() => {
    if (!jsonValue.trim()) {
      setParseError('')
      return
    }
    try {
      const parsed = JSON.parse(jsonValue)
      if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
        setParseError('"mcpServers" key not found. Expected format: { "mcpServers": { ... } }')
      } else {
        setParseError('')
      }
    } catch (e: any) {
      setParseError(e.message)
    }
  }, [jsonValue])

  const handleChange = useCallback((value: string) => {
    setJsonValue(value)
    setHasChanges(value !== lastSavedJson)
    setSyncStatus('idle')
    setSyncError('')
  }, [lastSavedJson])

  const handleSave = async () => {
    if (!jsonValue.trim()) return
    if (parseError) return

    setSyncStatus('saving')
    setSyncError('')
    try {
      await syncFromJson(jsonValue)
      // Re-export to get the normalized version
      const exported = await exportJson()
      setJsonValue(exported)
      setLastSavedJson(exported)
      setHasChanges(false)
      setSyncStatus('saved')
      setTestResults({})
      setTimeout(() => setSyncStatus('idle'), 2000)
    } catch (e: any) {
      setSyncStatus('error')
      setSyncError(e.message || 'Failed to sync')
    }
  }

  const handleReset = async () => {
    const exported = await exportJson()
    setJsonValue(exported)
    setLastSavedJson(exported)
    setHasChanges(false)
    setSyncStatus('idle')
    setSyncError('')
    setParseError('')
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonValue)
      setJsonValue(JSON.stringify(parsed, null, 2))
    } catch {
      // Can't format invalid JSON
    }
  }

  const handleImportFromClaude = async () => {
    setImportStatus('importing')
    setImportError('')
    try {
      const importedJson = await importFromClaude()
      // Update the editor with the imported JSON
      const exported = await exportJson()
      setJsonValue(exported)
      setLastSavedJson(exported)
      setHasChanges(false)
      setSyncStatus('idle')
      setImportStatus('done')
      setTimeout(() => setImportStatus('idle'), 2000)
    } catch (e: any) {
      setImportStatus('error')
      setImportError(e.message || 'Import failed')
      setTimeout(() => setImportStatus('idle'), 3000)
    }
  }

  const handleTestAll = async () => {
    if (parseError || !jsonValue.trim()) return

    setTestStatus('testing')
    setTestResults({})

    try {
      const parsed = JSON.parse(jsonValue)
      const mcpServers = parsed.mcpServers || {}
      const results: Record<string, ServerTestResult> = {}

      for (const [key, config] of Object.entries(mcpServers) as [string, any][]) {
        try {
          const result = await testServer(
            config.command || '',
            config.args || [],
            config.env || {}
          )
          results[key] = result
        } catch (e: any) {
          results[key] = {
            success: false,
            error: e.message || 'Test failed',
            durationMs: 0,
          }
        }
        // Update results progressively
        setTestResults({ ...results })
      }
    } catch {
      // Invalid JSON
    }
    setTestStatus('done')
  }

  // Count servers in current JSON
  const serverCount = (() => {
    try {
      const parsed = JSON.parse(jsonValue)
      return Object.keys(parsed.mcpServers || {}).length
    } catch {
      return 0
    }
  })()

  // Handle keyboard shortcut
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold font-display text-zinc-100">MCP Servers</h1>
        <p className="text-xs text-zinc-500 mt-1">
          Paste your <code className="px-1 py-0.5 bg-white/[0.06] rounded text-zinc-400">.mcp.json</code> configuration below. Save to activate.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.04] border border-white/[0.06] rounded-lg">
            <Server size={13} className="text-zinc-500" />
            <span className="text-xs text-zinc-400">
              {serverCount} server{serverCount !== 1 ? 's' : ''}
            </span>
          </div>

          {hasChanges && (
            <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
              <FileJson size={12} />
              Unsaved changes
            </span>
          )}

          {syncStatus === 'saved' && (
            <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400">
              <Check size={12} />
              Saved
            </span>
          )}

          {syncStatus === 'error' && (
            <span className="flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
              <AlertTriangle size={12} />
              {syncError}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleImportFromClaude}
            disabled={importStatus === 'importing'}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
              importStatus === 'done'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : importStatus === 'error'
                  ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                  : 'bg-white/[0.06] hover:bg-white/[0.10] text-zinc-300'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title="Import MCP servers from Claude CLI (~/.claude.json)"
          >
            <Download size={13} className={importStatus === 'importing' ? 'animate-pulse' : ''} />
            {importStatus === 'importing' ? 'Importing...'
              : importStatus === 'done' ? 'Imported!'
              : importStatus === 'error' ? (importError.length > 30 ? 'Import Failed' : importError)
              : 'Import from Claude'}
          </button>

          <div className="w-px h-4 bg-white/[0.06]" />

          <button
            onClick={handleTestAll}
            disabled={!!parseError || !jsonValue.trim() || testStatus === 'testing'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.10] text-zinc-300 text-xs rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Test all servers"
          >
            <Activity size={13} className={testStatus === 'testing' ? 'animate-pulse' : ''} />
            {testStatus === 'testing' ? 'Testing...' : 'Test All'}
          </button>

          <button
            onClick={handleFormat}
            disabled={!!parseError}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.10] text-zinc-300 text-xs rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Format JSON"
          >
            <FileJson size={13} />
            Format
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.10] text-zinc-300 text-xs rounded-lg transition-colors"
            title="Copy to clipboard"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.10] text-zinc-300 text-xs rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Reset to saved"
          >
            <RotateCcw size={13} />
            Reset
          </button>

          <button
            onClick={handleSave}
            disabled={!hasChanges || !!parseError || syncStatus === 'saving'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-gradient hover:opacity-90 text-white text-xs font-medium rounded-lg transition-[color,background-color,border-color,box-shadow,opacity] shadow-brand-sm disabled:opacity-40 disabled:cursor-not-allowed"
            title="Save & activate (Ctrl+S)"
          >
            <Save size={13} />
            {syncStatus === 'saving' ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Parse error banner */}
      {parseError && (
        <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
          <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-300 font-mono">{parseError}</p>
        </div>
      )}

      {/* JSON Editor */}
      <div className="flex-1 min-h-0 flex gap-3">
        <div className={`flex-1 relative rounded-xl border ${
          parseError
            ? 'border-red-500/30'
            : hasChanges
              ? 'border-amber-500/20'
              : 'border-white/[0.08]'
        } bg-[#0a0a0c] overflow-hidden`}>
          <textarea
            ref={textareaRef}
            value={jsonValue}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER_JSON}
            spellCheck={false}
            className="w-full h-full p-4 bg-transparent text-sm text-zinc-200 font-mono resize-none focus:outline-none placeholder:text-zinc-700 leading-relaxed"
          />

          {/* Line count indicator */}
          <div className="absolute bottom-2 right-3 text-[10px] text-zinc-600">
            {jsonValue.split('\n').length} lines
          </div>
        </div>

        {/* Test Results Panel (shown when there are results) */}
        {Object.keys(testResults).length > 0 && (
          <div className="w-72 flex-shrink-0 rounded-xl border border-white/[0.08] bg-[#111114] overflow-auto">
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <h3 className="text-xs font-medium text-zinc-300">Health Check Results</h3>
            </div>
            <div className="p-2 space-y-1.5">
              {Object.entries(testResults).map(([key, result]) => (
                <div
                  key={key}
                  className={`px-3 py-2 rounded-lg border ${
                    result.success
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-red-500/5 border-red-500/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      result.success ? 'bg-emerald-400' : 'bg-red-400'
                    }`} />
                    <span className="text-xs font-medium text-zinc-200 font-mono">{key}</span>
                  </div>
                  {result.success ? (
                    <div className="ml-3.5">
                      {result.serverName && (
                        <p className="text-[10px] text-zinc-400">
                          {result.serverName} {result.version && `v${result.version}`}
                        </p>
                      )}
                      <p className="text-[10px] text-emerald-400">{result.durationMs}ms</p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-red-400 ml-3.5 break-all">{result.error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[10px] text-zinc-600">
          Ctrl+S to save. Servers are injected as <code className="text-zinc-500">.mcp.json</code> into task workspaces at runtime.
        </p>
        <p className="text-[10px] text-zinc-600">
          Format: <code className="text-zinc-500">{'{ "mcpServers": { "<key>": { "command": "...", "args": [...], "env": {...} } } }'}</code>
        </p>
      </div>
    </div>
  )
}
