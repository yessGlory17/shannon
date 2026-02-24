import { AlertTriangle } from 'lucide-react'
import type { ProjectSetupStatus, SetupAction } from '../../../types'

interface SetupOptionsStepProps {
  status: ProjectSetupStatus
  actions: SetupAction
  onChange: (actions: SetupAction) => void
}

export function SetupOptionsStep({ status, actions, onChange }: SetupOptionsStepProps) {
  const hasUncommittedWork = status.untracked_count > 0 || status.uncommitted_count > 0

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400 mb-4">
        Select the setup steps to run for this project:
      </p>

      {/* Git Init */}
      <label
        className={`flex items-start gap-3 p-3 rounded-md border transition-colors ${
          status.has_git
            ? 'bg-zinc-800/30 border-zinc-700/30 opacity-50 cursor-not-allowed'
            : actions.init_git
            ? 'bg-emerald-600/10 border-emerald-600/30 cursor-pointer'
            : 'bg-zinc-800/50 border-zinc-700/50 cursor-pointer hover:border-zinc-600'
        }`}
      >
        <input
          type="checkbox"
          checked={actions.init_git}
          disabled={status.has_git}
          onChange={(e) => onChange({ ...actions, init_git: e.target.checked })}
          className="mt-0.5 accent-emerald-500"
        />
        <div>
          <p className="text-sm font-medium text-zinc-200">Initialize Git repository</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {status.has_git
              ? 'Already initialized'
              : 'Run git init to create a new repository'}
          </p>
        </div>
      </label>

      {/* .gitignore */}
      <label
        className={`flex items-start gap-3 p-3 rounded-md border transition-colors ${
          status.has_gitignore
            ? 'bg-zinc-800/30 border-zinc-700/30 opacity-50 cursor-not-allowed'
            : actions.create_gitignore
            ? 'bg-emerald-600/10 border-emerald-600/30 cursor-pointer'
            : 'bg-zinc-800/50 border-zinc-700/50 cursor-pointer hover:border-zinc-600'
        }`}
      >
        <input
          type="checkbox"
          checked={actions.create_gitignore}
          disabled={status.has_gitignore}
          onChange={(e) => onChange({ ...actions, create_gitignore: e.target.checked })}
          className="mt-0.5 accent-emerald-500"
        />
        <div>
          <p className="text-sm font-medium text-zinc-200">Create .gitignore</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {status.has_gitignore
              ? 'Already exists — will not be overwritten'
              : status.detected_type?.name !== 'unknown'
              ? `Generate template for ${status.detected_type.name} project`
              : 'Generate a generic .gitignore template'}
          </p>
        </div>
      </label>

      {/* Initial Commit */}
      <label
        className={`flex items-start gap-3 p-3 rounded-md border transition-colors ${
          status.has_commits && status.is_clean_tree
            ? 'bg-zinc-800/30 border-zinc-700/30 opacity-50 cursor-not-allowed'
            : actions.initial_commit
            ? 'bg-emerald-600/10 border-emerald-600/30 cursor-pointer'
            : 'bg-zinc-800/50 border-zinc-700/50 cursor-pointer hover:border-zinc-600'
        }`}
      >
        <input
          type="checkbox"
          checked={actions.initial_commit}
          disabled={status.has_commits && status.is_clean_tree}
          onChange={(e) => onChange({ ...actions, initial_commit: e.target.checked })}
          className="mt-0.5 accent-emerald-500"
        />
        <div>
          <p className="text-sm font-medium text-zinc-200">Create initial commit</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {status.has_commits && status.is_clean_tree
              ? 'Already has commits and working tree is clean'
              : 'Stage all files and create an initial commit'}
          </p>
        </div>
      </label>

      {/* Warning for uncommitted work */}
      {actions.initial_commit && hasUncommittedWork && (
        <div className="flex items-start gap-3 px-3 py-2.5 bg-amber-600/10 border border-amber-600/20 rounded-md">
          <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
          <span className="text-xs text-amber-300">
            This will commit all current files:
            {status.untracked_count > 0 && ` ${status.untracked_count} untracked`}
            {status.untracked_count > 0 && status.uncommitted_count > 0 && ','}
            {status.uncommitted_count > 0 && ` ${status.uncommitted_count} uncommitted changes`}
          </span>
        </div>
      )}
    </div>
  )
}
