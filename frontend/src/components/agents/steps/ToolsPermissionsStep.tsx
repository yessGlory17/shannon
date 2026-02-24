import { useEffect } from 'react'
import { Server } from 'lucide-react'
import { useMCPStore } from '../../../stores/mcpStore'

const TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'Task', 'NotebookEdit']
const PERMISSIONS = [
  { value: 'default', label: 'Default', desc: 'Standard permission prompts' },
  { value: 'acceptEdits', label: 'Accept Edits', desc: 'Auto-accept file edits' },
  { value: 'bypassPermissions', label: 'Bypass All', desc: 'Skip all permission prompts' },
]

interface ToolsPermissionsStepProps {
  form: {
    allowed_tools: string[]
    mcp_server_ids: string[]
    permissions: string
  }
  onChange: (updates: Partial<{ allowed_tools: string[]; mcp_server_ids: string[]; permissions: string }>) => void
}

export function ToolsPermissionsStep({ form, onChange }: ToolsPermissionsStepProps) {
  const { servers, fetch: fetchMCP } = useMCPStore()

  useEffect(() => {
    fetchMCP()
  }, [fetchMCP])

  const toggleTool = (tool: string) => {
    const updated = form.allowed_tools.includes(tool)
      ? form.allowed_tools.filter((t) => t !== tool)
      : [...form.allowed_tools, tool]
    onChange({ allowed_tools: updated })
  }

  const toggleMCP = (id: string) => {
    const ids = form.mcp_server_ids || []
    const updated = ids.includes(id)
      ? ids.filter((x) => x !== id)
      : [...ids, id]
    onChange({ mcp_server_ids: updated })
  }

  const enabledServers = servers.filter((s) => s.enabled)

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-zinc-500 mb-2">Allowed Tools</label>
        <div className="flex flex-wrap gap-1.5">
          {TOOLS.map((tool) => (
            <button
              key={tool}
              onClick={() => toggleTool(tool)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                form.allowed_tools.includes(tool)
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/40'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:border-zinc-600'
              }`}
            >
              {tool}
            </button>
          ))}
        </div>
      </div>

      {/* MCP Servers */}
      <div>
        <label className="block text-xs text-zinc-500 mb-2">
          MCP Servers
          <span className="text-zinc-600 ml-1">(injected as .mcp.json into workspace)</span>
        </label>
        {enabledServers.length === 0 ? (
          <p className="text-xs text-zinc-600 py-2">
            No MCP servers configured. Add servers in the MCP Servers page.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {enabledServers.map((srv) => {
              const selected = (form.mcp_server_ids || []).includes(srv.id)
              return (
                <button
                  key={srv.id}
                  onClick={() => toggleMCP(srv.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
                    selected
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-600/40'
                      : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <Server size={10} />
                  {srv.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs text-zinc-500 mb-2">Permission Mode</label>
        <div className="space-y-1.5">
          {PERMISSIONS.map((p) => (
            <label
              key={p.value}
              className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                form.permissions === p.value
                  ? 'bg-emerald-600/10 border border-emerald-600/30'
                  : 'bg-zinc-800 border border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <input
                type="radio"
                name="permissions"
                value={p.value}
                checked={form.permissions === p.value}
                onChange={(e) => onChange({ permissions: e.target.value })}
                className="accent-emerald-500"
              />
              <div>
                <span className="text-sm text-zinc-200">{p.label}</span>
                <p className="text-xs text-zinc-500">{p.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
