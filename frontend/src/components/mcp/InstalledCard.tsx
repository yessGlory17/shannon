import {
  Trash2, Pencil, ChevronDown, ChevronRight,
  ToggleLeft, ToggleRight, AlertTriangle,
} from 'lucide-react'
import type { MCPServer } from '../../types'

interface InstalledCardProps {
  server: MCPServer
  expanded: boolean
  onToggleExpand: () => void
  onToggleEnabled: () => void
  onConfigure: () => void
  onRemove: () => void
}

export function InstalledCard({
  server,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  onConfigure,
  onRemove,
}: InstalledCardProps) {
  const hasEmptyRequiredEnv = server.env && Object.values(server.env).some((v) => !v)

  return (
    <div className="rounded-xl bg-[#111114] border border-white/[0.06] shadow-card">
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
              <span className="px-1.5 py-0.5 bg-white/[0.06] rounded text-xs text-zinc-500 font-mono">
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
        <div className="px-4 pb-4 pt-0 border-t border-white/[0.06] mt-0">
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
