import { GitBranch, FileText, FolderGit2, AlertTriangle, Check, X } from 'lucide-react'
import type { ProjectSetupStatus } from '../../../types'

interface SetupStatusStepProps {
  status: ProjectSetupStatus
}

export function SetupStatusStep({ status }: SetupStatusStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400 mb-4">
        Project analysis complete. Here is the current state:
      </p>

      {/* Git Status */}
      <div className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-md border border-zinc-700/50">
        <FolderGit2 size={18} className={status.has_git ? 'text-emerald-400 mt-0.5' : 'text-amber-400 mt-0.5'} />
        <div>
          <p className="text-sm font-medium text-zinc-200">
            {status.has_git ? 'Git initialized' : 'Git not initialized'}
          </p>
          {status.has_git && status.current_branch && (
            <p className="text-xs text-zinc-500 mt-0.5">
              Branch: <code className="text-zinc-400">{status.current_branch}</code>
            </p>
          )}
        </div>
        <div className="ml-auto">
          {status.has_git ? (
            <Check size={16} className="text-emerald-400" />
          ) : (
            <X size={16} className="text-amber-400" />
          )}
        </div>
      </div>

      {/* Commits */}
      <div className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-md border border-zinc-700/50">
        <GitBranch size={18} className={status.has_commits ? 'text-emerald-400 mt-0.5' : 'text-amber-400 mt-0.5'} />
        <div>
          <p className="text-sm font-medium text-zinc-200">
            {status.has_commits ? 'Has commits' : 'No commits yet'}
          </p>
          {status.has_git && !status.is_clean_tree && (
            <p className="text-xs text-zinc-500 mt-0.5">
              {status.untracked_count > 0 && `${status.untracked_count} untracked`}
              {status.untracked_count > 0 && status.uncommitted_count > 0 && ', '}
              {status.uncommitted_count > 0 && `${status.uncommitted_count} uncommitted`}
            </p>
          )}
        </div>
        <div className="ml-auto">
          {status.has_commits ? (
            <Check size={16} className="text-emerald-400" />
          ) : (
            <X size={16} className="text-amber-400" />
          )}
        </div>
      </div>

      {/* .gitignore */}
      <div className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-md border border-zinc-700/50">
        <FileText size={18} className={status.has_gitignore ? 'text-emerald-400 mt-0.5' : 'text-amber-400 mt-0.5'} />
        <div>
          <p className="text-sm font-medium text-zinc-200">
            {status.has_gitignore ? '.gitignore present' : '.gitignore missing'}
          </p>
        </div>
        <div className="ml-auto">
          {status.has_gitignore ? (
            <Check size={16} className="text-emerald-400" />
          ) : (
            <X size={16} className="text-amber-400" />
          )}
        </div>
      </div>

      {/* Detected Project Type */}
      {status.detected_type && status.detected_type.name !== 'unknown' && (
        <div className="flex items-start gap-3 px-3 py-2.5 bg-blue-600/10 border border-blue-600/20 rounded-md">
          <span className="text-xs text-blue-300">
            Detected as <strong className="text-blue-200">{status.detected_type.name}</strong> project
            {status.detected_type.indicators?.length > 0 && (
              <span className="text-blue-400"> ({status.detected_type.indicators.join(', ')})</span>
            )}
          </span>
        </div>
      )}

      {/* Warning if not ready */}
      {!status.is_ready && (
        <div className="flex items-start gap-3 px-3 py-2.5 bg-amber-600/10 border border-amber-600/20 rounded-md">
          <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
          <span className="text-xs text-amber-300">
            This project needs setup before it can be used with worktree-based parallel workflows.
            Continue to configure the setup options.
          </span>
        </div>
      )}
    </div>
  )
}
