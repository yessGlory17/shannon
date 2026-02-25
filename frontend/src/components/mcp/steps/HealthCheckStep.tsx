import { useState } from 'react'
import { Play, CheckCircle2, XCircle, Loader2, SkipForward } from 'lucide-react'
import { useMCPStore } from '../../../stores/mcpStore'
import type { MCPWizardData } from '../../../types'

interface HealthCheckStepProps {
  data: MCPWizardData
  onChange: (updates: Partial<MCPWizardData>) => void
}

type CheckState = 'idle' | 'running' | 'success' | 'failed'

export function HealthCheckStep({ data, onChange }: HealthCheckStepProps) {
  const { testServer } = useMCPStore()
  const [state, setState] = useState<CheckState>(
    data.healthResult ? (data.healthResult.success ? 'success' : 'failed') : 'idle'
  )
  const [running, setRunning] = useState(false)

  const runTest = async () => {
    setState('running')
    setRunning(true)
    try {
      const result = await testServer(data.command, data.args || [], data.env || {})
      onChange({ healthResult: result, healthChecked: true })
      setState(result.success ? 'success' : 'failed')
    } catch (e: any) {
      onChange({
        healthResult: {
          success: false,
          error: e?.message || 'Unknown error',
          durationMs: 0,
        },
        healthChecked: true,
      })
      setState('failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="text-center py-2">
        <h3 className="text-sm font-medium text-zinc-200 mb-1">Connection Test</h3>
        <p className="text-xs text-zinc-500">
          Test your MCP server by starting the process and sending an initialize handshake.
        </p>
      </div>

      {/* Server info summary */}
      <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-500">Command:</span>
          <code className="text-zinc-300 font-mono">{data.command} {(data.args || []).join(' ')}</code>
        </div>
        {data.env && Object.keys(data.env).filter(k => data.env[k]).length > 0 && (
          <div className="flex items-center gap-2 text-xs mt-1">
            <span className="text-zinc-500">Env vars:</span>
            <span className="text-zinc-400">
              {Object.keys(data.env).filter(k => data.env[k]).length} configured
            </span>
          </div>
        )}
      </div>

      {/* Test states */}
      {state === 'idle' && (
        <div className="flex flex-col items-center py-6">
          <button
            onClick={runTest}
            className="flex items-center gap-2 px-6 py-3 bg-brand-gradient hover:opacity-90 text-white text-sm font-medium rounded-xl transition-all shadow-brand-sm"
          >
            <Play size={16} />
            Run Test
          </button>
          <p className="text-[11px] text-zinc-600 mt-3">
            This will start the server process and verify it responds correctly.
          </p>
        </div>
      )}

      {state === 'running' && (
        <div className="flex flex-col items-center py-6">
          <div className="w-12 h-12 rounded-full bg-blue-600/10 border border-blue-600/20 flex items-center justify-center mb-3">
            <Loader2 size={24} className="animate-spin text-blue-400" />
          </div>
          <p className="text-sm text-zinc-300">Testing connection...</p>
          <p className="text-xs text-zinc-500 mt-1">Starting server and sending initialize request</p>
        </div>
      )}

      {state === 'success' && data.healthResult && (
        <div className="space-y-3">
          <div className="flex flex-col items-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center mb-3">
              <CheckCircle2 size={24} className="text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-emerald-300">Server is working</p>
          </div>

          <div className="p-4 rounded-lg bg-emerald-600/5 border border-emerald-600/15 space-y-2">
            {data.healthResult.serverName && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Server Name</span>
                <span className="text-zinc-200 font-mono">{data.healthResult.serverName}</span>
              </div>
            )}
            {data.healthResult.version && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Version</span>
                <span className="text-zinc-200 font-mono">{data.healthResult.version}</span>
              </div>
            )}
            {data.healthResult.capabilities && data.healthResult.capabilities.length > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Capabilities</span>
                <div className="flex gap-1 flex-wrap justify-end">
                  {data.healthResult.capabilities.map((cap) => (
                    <span key={cap} className="px-1.5 py-0.5 bg-emerald-600/15 text-emerald-300 rounded text-[10px]">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Response Time</span>
              <span className="text-zinc-200">{data.healthResult.durationMs}ms</span>
            </div>
          </div>

          <button
            onClick={runTest}
            disabled={running}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Run again
          </button>
        </div>
      )}

      {state === 'failed' && data.healthResult && (
        <div className="space-y-3">
          <div className="flex flex-col items-center py-4">
            <div className="w-12 h-12 rounded-full bg-red-600/10 border border-red-600/20 flex items-center justify-center mb-3">
              <XCircle size={24} className="text-red-400" />
            </div>
            <p className="text-sm font-medium text-red-300">Connection failed</p>
          </div>

          <div className="p-4 rounded-lg bg-red-600/5 border border-red-600/15">
            <pre className="text-xs text-red-300 whitespace-pre-wrap break-words font-mono">
              {data.healthResult.error}
            </pre>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={runTest}
              disabled={running}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-gradient hover:opacity-90 text-white text-sm font-medium rounded-lg transition-all shadow-brand-sm disabled:opacity-50"
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Try Again
            </button>
            <button
              onClick={() => setState('idle')}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.10] text-zinc-300 text-sm rounded-lg transition-colors"
            >
              <SkipForward size={14} />
              Skip Test
            </button>
          </div>

          <p className="text-[11px] text-zinc-600 text-center">
            You can still install the server without a successful test. Check your credentials and try again later.
          </p>
        </div>
      )}
    </div>
  )
}
