import { useEffect, useState } from 'react'
import { Save, Trash2, HardDrive, Loader2, Plus, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import type { Config } from '../types'

export function Settings() {
  const [config, setConfig] = useState<Config | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [cleaning, setCleaning] = useState(false)

  // Env vars (stored in encrypted vault, separate from config)
  const defaultEnvKeys: Record<string, string> = {
    CLAUDE_CODE_USE_BEDROCK: '',
    AWS_BEARER_TOKEN_BEDROCK: '',
    AWS_REGION: '',
    ANTHROPIC_MODEL: '',
  }
  const [envVars, setEnvVars] = useState<Record<string, string>>({})
  const [newEnvKey, setNewEnvKey] = useState('')
  const [newEnvValue, setNewEnvValue] = useState('')
  const [showValues, setShowValues] = useState(false)
  const [savingEnv, setSavingEnv] = useState(false)
  const [savedEnv, setSavedEnv] = useState(false)

  useEffect(() => {
    window.go.main.App.GetConfig().then(setConfig).catch(console.error)
    window.go.main.App.GetEnvVars().then((vars) => {
      const loaded = vars || {}
      // Merge default keys (only add missing ones, don't overwrite existing)
      const merged = { ...defaultEnvKeys, ...loaded }
      setEnvVars(merged)
    }).catch(console.error)
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

  const handleSaveEnvVars = async () => {
    setSavingEnv(true)
    setSavedEnv(false)
    try {
      await window.go.main.App.UpdateEnvVars(envVars)
      setSavedEnv(true)
      setTimeout(() => setSavedEnv(false), 2000)
    } catch (e) {
      console.error('Failed to save env vars:', e)
    } finally {
      setSavingEnv(false)
    }
  }

  const addEnvVar = () => {
    if (!newEnvKey.trim()) return
    setEnvVars({ ...envVars, [newEnvKey.trim()]: newEnvValue })
    setNewEnvKey('')
    setNewEnvValue('')
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
        <Loader2 size={20} className="text-brand-blue animate-spin" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl">
      <h1 className="text-2xl font-bold font-display text-zinc-100 mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Claude CLI */}
        <div className="rounded-xl bg-[#111114] border border-white/[0.06] shadow-card p-5">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">Claude CLI</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1.5">CLI Path</label>
              <input
                value={config.claude_cli_path}
                onChange={(e) => setConfig({ ...config, claude_cli_path: e.target.value })}
                placeholder="claude"
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 input-focus transition-colors"
              />
              <p className="text-xs text-zinc-600 mt-1">
                Path to the Claude CLI binary. Default: "claude" (uses PATH)
              </p>
            </div>
          </div>
        </div>

        {/* Environment Variables (Encrypted Vault) */}
        <div className="rounded-xl bg-[#111114] border border-white/[0.06] shadow-card p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-emerald-500" />
              <h2 className="text-sm font-medium text-zinc-300">Environment Variables</h2>
            </div>
            <button
              onClick={() => setShowValues(!showValues)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showValues ? <EyeOff size={12} /> : <Eye size={12} />}
              {showValues ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="text-xs text-zinc-600 mb-4">
            Encrypted with AES-256-GCM. Passed to Claude CLI subprocesses at runtime.
          </p>

          <div className="space-y-2 mb-3">
            {Object.entries(envVars).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <input
                  value={key}
                  readOnly
                  className="w-1/3 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-zinc-100 font-mono"
                />
                <input
                  value={value}
                  onChange={(e) => {
                    setEnvVars({ ...envVars, [key]: e.target.value })
                  }}
                  type={showValues ? 'text' : 'password'}
                  className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-zinc-100 font-mono input-focus transition-colors"
                />
                <button
                  onClick={() => {
                    const updated = { ...envVars }
                    delete updated[key]
                    setEnvVars(updated)
                  }}
                  className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-4">
            <input
              placeholder="KEY"
              value={newEnvKey}
              onChange={(e) => setNewEnvKey(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') addEnvVar() }}
              className="w-1/3 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 font-mono input-focus transition-colors"
            />
            <input
              placeholder="value"
              value={newEnvValue}
              onChange={(e) => setNewEnvValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addEnvVar() }}
              type={showValues ? 'text' : 'password'}
              className="flex-1 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 font-mono input-focus transition-colors"
            />
            <button
              onClick={addEnvVar}
              disabled={!newEnvKey.trim()}
              className="p-2 text-zinc-500 hover:text-emerald-400 disabled:opacity-30 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-white/[0.06]">
            <button
              onClick={handleSaveEnvVars}
              disabled={savingEnv}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg disabled:opacity-50 transition-colors border border-emerald-500/20"
            >
              {savingEnv ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <ShieldCheck size={12} />
              )}
              {savingEnv ? 'Encrypting...' : 'Save to Vault'}
            </button>
            {savedEnv && (
              <span className="text-xs text-emerald-400">Encrypted & saved</span>
            )}
          </div>
        </div>

        {/* Paths */}
        <div className="rounded-xl bg-[#111114] border border-white/[0.06] shadow-card p-5">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">Storage</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1.5">Workspace Directory</label>
              <input
                value={config.workspace_path}
                onChange={(e) => setConfig({ ...config, workspace_path: e.target.value })}
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 input-focus transition-colors"
              />
              <p className="text-xs text-zinc-600 mt-1">
                Directory for isolated task workspaces (project copies)
              </p>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1.5">Data Directory</label>
              <input
                value={config.data_dir}
                onChange={(e) => setConfig({ ...config, data_dir: e.target.value })}
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 input-focus transition-colors"
              />
              <p className="text-xs text-zinc-600 mt-1">
                Directory for database and configuration files
              </p>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="rounded-xl bg-[#111114] border border-white/[0.06] shadow-card p-5">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">Preferences</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1.5">Log Level</label>
              <select
                value={config.log_level}
                onChange={(e) => setConfig({ ...config, log_level: e.target.value })}
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-zinc-100 input-focus transition-colors"
              >
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 font-medium mb-1.5">Language</label>
              <select
                value={config.language}
                onChange={(e) => setConfig({ ...config, language: e.target.value })}
                className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-zinc-100 input-focus transition-colors"
              >
                <option value="en">English</option>
                <option value="tr">Turkish</option>
              </select>
            </div>
          </div>
        </div>

        {/* Maintenance */}
        <div className="rounded-xl bg-[#111114] border border-white/[0.06] shadow-card p-5">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">Maintenance</h2>
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
              className="flex items-center gap-2 px-3 py-2 bg-white/[0.06] hover:bg-white/[0.10] text-zinc-300 text-sm rounded-lg disabled:opacity-50 transition-colors"
            >
              {cleaning ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              {cleaning ? 'Cleaning...' : 'Clean'}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06]">
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
            className="flex items-center gap-2 px-4 py-2 bg-brand-gradient hover:opacity-90 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-[color,background-color,border-color,box-shadow,opacity] shadow-brand-sm"
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
