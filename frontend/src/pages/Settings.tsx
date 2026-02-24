import { useEffect, useState } from 'react'
import { Save, Trash2, HardDrive, Loader2 } from 'lucide-react'
import type { Config } from '../types'

export function Settings() {
  const [config, setConfig] = useState<Config | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [cleaning, setCleaning] = useState(false)

  useEffect(() => {
    window.go.main.App.GetConfig().then(setConfig).catch(console.error)
  }, [])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    setSaved(false)
    try {
      await window.go.main.App.UpdateConfig(config)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error('Failed to save config:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleCleanupWorkspaces = async () => {
    setCleaning(true)
    try {
      await window.go.main.App.CleanupAllWorkspaces()
    } catch (e) {
      console.error('Cleanup failed:', e)
    } finally {
      setCleaning(false)
    }
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="text-zinc-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl">
      <h1 className="text-2xl font-semibold text-zinc-100 mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Claude CLI */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <h2 className="text-sm font-medium text-zinc-200 mb-4">Claude CLI</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">CLI Path</label>
              <input
                value={config.claude_cli_path}
                onChange={(e) => setConfig({ ...config, claude_cli_path: e.target.value })}
                placeholder="claude"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
              />
              <p className="text-xs text-zinc-600 mt-1">
                Path to the Claude CLI binary. Default: "claude" (uses PATH)
              </p>
            </div>
          </div>
        </div>

        {/* Paths */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <h2 className="text-sm font-medium text-zinc-200 mb-4">Storage</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Workspace Directory</label>
              <input
                value={config.workspace_path}
                onChange={(e) => setConfig({ ...config, workspace_path: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
              />
              <p className="text-xs text-zinc-600 mt-1">
                Directory for isolated task workspaces (project copies)
              </p>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Data Directory</label>
              <input
                value={config.data_dir}
                onChange={(e) => setConfig({ ...config, data_dir: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
              />
              <p className="text-xs text-zinc-600 mt-1">
                Directory for database and configuration files
              </p>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <h2 className="text-sm font-medium text-zinc-200 mb-4">Preferences</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Log Level</label>
              <select
                value={config.log_level}
                onChange={(e) => setConfig({ ...config, log_level: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
              >
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Language</label>
              <select
                value={config.language}
                onChange={(e) => setConfig({ ...config, language: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
              >
                <option value="en">English</option>
                <option value="tr">Turkish</option>
              </select>
            </div>
          </div>
        </div>

        {/* Maintenance */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <h2 className="text-sm font-medium text-zinc-200 mb-4">Maintenance</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-300">Clean up workspaces</p>
              <p className="text-xs text-zinc-600 mt-0.5">
                Remove workspace copies from completed/failed sessions
              </p>
            </div>
            <button
              onClick={handleCleanupWorkspaces}
              disabled={cleaning}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md disabled:opacity-50 transition-colors"
            >
              {cleaning ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              {cleaning ? 'Cleaning...' : 'Clean'}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800">
            <HardDrive size={14} className="text-zinc-600" />
            <p className="text-xs text-zinc-600">
              Workspace: {config.workspace_path}
            </p>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-900 text-sm font-medium rounded-md disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && (
            <span className="text-sm text-emerald-400">Settings saved</span>
          )}
        </div>
      </div>
    </div>
  )
}
