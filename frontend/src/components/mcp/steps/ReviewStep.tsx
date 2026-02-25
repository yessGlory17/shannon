import { CheckCircle2, XCircle, ToggleLeft, ToggleRight } from 'lucide-react'
import type { MCPWizardData } from '../../../types'

interface ReviewStepProps {
  data: MCPWizardData
  onChange: (updates: Partial<MCPWizardData>) => void
}

function isSecretField(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.includes('token') || lower.includes('secret') || lower.includes('key') || lower.includes('password')
}

export function ReviewStep({ data, onChange }: ReviewStepProps) {
  const envEntries = Object.entries(data.env || {}).filter(([, v]) => v)

  return (
    <div className="space-y-5">
      <div className="text-center py-1">
        <h3 className="text-sm font-medium text-zinc-200 mb-1">Review Configuration</h3>
        <p className="text-xs text-zinc-500">
          Verify your MCP server settings before installing.
        </p>
      </div>

      {/* Summary card */}
      <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] divide-y divide-white/[0.06]">
        {/* Name & Key */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-zinc-100">{data.name}</h4>
            <span className="px-2 py-0.5 bg-white/[0.06] rounded text-xs text-zinc-500 font-mono">
              {data.server_key}
            </span>
          </div>
          {data.description && (
            <p className="text-xs text-zinc-500">{data.description}</p>
          )}
        </div>

        {/* Command */}
        <div className="p-4">
          <span className="text-xs text-zinc-500 block mb-1">Command</span>
          <code className="text-xs font-mono text-zinc-200">
            {data.command} {(data.args || []).join(' ')}
          </code>
        </div>

        {/* Env Vars */}
        {envEntries.length > 0 && (
          <div className="p-4">
            <span className="text-xs text-zinc-500 block mb-2">Environment Variables</span>
            <div className="space-y-1.5">
              {envEntries.map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-zinc-400">{key}</span>
                  <span className="text-zinc-600">=</span>
                  <span className="font-mono text-zinc-500">
                    {isSecretField(key) ? '•'.repeat(Math.min(value.length, 20)) : value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Health Check Result */}
        {data.healthChecked && data.healthResult && (
          <div className="p-4">
            <span className="text-xs text-zinc-500 block mb-2">Connection Test</span>
            {data.healthResult.success ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span className="text-xs text-emerald-300">
                  Passed
                  {data.healthResult.serverName && ` — ${data.healthResult.serverName}`}
                  {data.healthResult.version && ` v${data.healthResult.version}`}
                </span>
                <span className="text-[10px] text-zinc-600 ml-auto">{data.healthResult.durationMs}ms</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle size={14} className="text-red-400" />
                <span className="text-xs text-red-300">Failed</span>
              </div>
            )}
          </div>
        )}

        {/* Enabled toggle */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400">Enabled</span>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              {data.enabled ? 'Server will be active and available to agents' : 'Server will be saved but inactive'}
            </p>
          </div>
          <button
            onClick={() => onChange({ enabled: !data.enabled })}
            className="p-1 transition-colors"
          >
            {data.enabled ? (
              <ToggleRight size={24} className="text-emerald-400" />
            ) : (
              <ToggleLeft size={24} className="text-zinc-500" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
