import { useEffect, useState } from 'react'
import { Plus, X, ExternalLink, Loader2 } from 'lucide-react'
import { useMCPStore } from '../../../stores/mcpStore'
import type { MCPWizardData } from '../../../types'

interface ConfigureStepProps {
  data: MCPWizardData
  onChange: (updates: Partial<MCPWizardData>) => void
}

function formatEnvLabel(envName: string): string {
  return envName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bApi\b/g, 'API')
    .replace(/\bUrl\b/g, 'URL')
    .replace(/\bId\b/g, 'ID')
}

function isSecretField(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.includes('token') || lower.includes('secret') || lower.includes('key') || lower.includes('password')
}

export function ConfigureStep({ data, onChange }: ConfigureStepProps) {
  const { getInstallConfig } = useMCPStore()
  const [configLoading, setConfigLoading] = useState(false)
  const [customEnvRows, setCustomEnvRows] = useState<{ key: string; value: string }[]>([])

  // Fetch install config for catalog items
  useEffect(() => {
    if (data.source === 'catalog' && data.catalogItem && !data.command) {
      setConfigLoading(true)
      getInstallConfig(data.catalogItem.qualifiedName).then((config) => {
        const env: Record<string, string> = {}
        if (config.envVars) {
          for (const v of config.envVars) {
            env[v.name] = data.env[v.name] || ''
          }
        }
        onChange({
          command: config.command,
          args: config.args,
          envDefs: config.envVars || [],
          docUrl: config.docUrl,
          env,
        })
      }).finally(() => setConfigLoading(false))
    }
  }, [data.source, data.catalogItem, data.command, getInstallConfig, onChange, data.env])

  const updateEnv = (key: string, value: string) => {
    onChange({ env: { ...data.env, [key]: value } })
  }

  const addCustomEnvRow = () => {
    setCustomEnvRows([...customEnvRows, { key: '', value: '' }])
  }

  const updateCustomEnvRow = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...customEnvRows]
    updated[index] = { ...updated[index], [field]: val }
    setCustomEnvRows(updated)

    // Sync to data.env
    const env = { ...data.env }
    // Remove old key if it was renamed
    if (field === 'key') {
      const oldKey = customEnvRows[index].key
      if (oldKey && oldKey !== val) {
        delete env[oldKey]
      }
    }
    if (updated[index].key.trim()) {
      env[updated[index].key.trim()] = updated[index].value
    }
    onChange({ env })
  }

  const removeCustomEnvRow = (index: number) => {
    const env = { ...data.env }
    const key = customEnvRows[index].key
    if (key) delete env[key]
    setCustomEnvRows(customEnvRows.filter((_, i) => i !== index))
    onChange({ env })
  }

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-zinc-500" />
        <span className="ml-2 text-sm text-zinc-500">Loading configuration...</span>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Doc URL */}
      {data.docUrl && (
        <a
          href={data.docUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-3 rounded-lg bg-blue-600/10 border border-blue-600/20 text-xs text-blue-300 hover:bg-blue-600/15 transition-colors"
        >
          <ExternalLink size={14} />
          View setup documentation & get API keys
        </a>
      )}

      {/* Name & Server Key */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Display Name <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g., GitHub"
            className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 input-focus transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Server Key <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={data.server_key}
            onChange={(e) => onChange({ server_key: e.target.value })}
            placeholder="e.g., github"
            className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 input-focus transition-colors font-mono"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Description</label>
        <input
          type="text"
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What this server provides..."
          className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 input-focus transition-colors"
        />
      </div>

      {/* Command */}
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Command <span className="text-red-400">*</span></label>
        <input
          type="text"
          value={data.command}
          onChange={(e) => onChange({ command: e.target.value })}
          placeholder="e.g., npx, uvx, node"
          className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 input-focus transition-colors font-mono"
        />
      </div>

      {/* Arguments */}
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Arguments (one per line)</label>
        <textarea
          value={(data.args || []).join('\n')}
          onChange={(e) => onChange({ args: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
          placeholder={'-y\n@scope/mcp-server'}
          rows={3}
          className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 input-focus transition-colors font-mono resize-none"
        />
      </div>

      {/* Environment Variables from envDefs (smart form) */}
      {data.envDefs && data.envDefs.length > 0 && (
        <div>
          <label className="block text-xs text-zinc-400 mb-2">Credentials</label>
          <div className="space-y-3">
            {data.envDefs.map((def) => (
              <div key={def.name}>
                <div className="flex items-center gap-1.5 mb-1">
                  <label className="text-xs font-medium text-zinc-200">
                    {formatEnvLabel(def.name)}
                  </label>
                  {def.required && <span className="text-red-400 text-[10px]">required</span>}
                </div>
                {def.description && (
                  <p className="text-[11px] text-zinc-500 mb-1.5">{def.description}</p>
                )}
                <input
                  type={isSecretField(def.name) ? 'password' : 'text'}
                  value={data.env[def.name] || ''}
                  onChange={(e) => updateEnv(def.name, e.target.value)}
                  placeholder={def.placeholder || ''}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-200 placeholder:text-zinc-600 input-focus transition-colors font-mono"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extra env vars (manual) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-zinc-400">
            {data.envDefs && data.envDefs.length > 0 ? 'Additional Environment Variables' : 'Environment Variables'}
          </label>
          <button
            onClick={addCustomEnvRow}
            className="flex items-center gap-1 px-2 py-0.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
          >
            <Plus size={10} />
            Add
          </button>
        </div>
        {customEnvRows.length === 0 && (!data.envDefs || data.envDefs.length === 0) && (
          <p className="text-xs text-zinc-600 py-1">No environment variables configured</p>
        )}
        {customEnvRows.length > 0 && (
          <div className="space-y-2">
            {customEnvRows.map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={entry.key}
                  onChange={(e) => updateCustomEnvRow(i, 'key', e.target.value)}
                  placeholder="KEY"
                  className="w-1/3 px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 input-focus transition-colors font-mono"
                />
                <span className="text-zinc-600 text-xs">=</span>
                <input
                  type={isSecretField(entry.key) ? 'password' : 'text'}
                  value={entry.value}
                  onChange={(e) => updateCustomEnvRow(i, 'value', e.target.value)}
                  placeholder="value"
                  className="flex-1 px-2 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 input-focus transition-colors font-mono"
                />
                <button
                  onClick={() => removeCustomEnvRow(i)}
                  className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
