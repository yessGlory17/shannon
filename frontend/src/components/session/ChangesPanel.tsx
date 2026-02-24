import { useState, useEffect, useMemo } from 'react'
import {
  FileCode, FilePlus, FileX, Check, X, Pencil,
  Loader2, ChevronRight, CheckCircle, XCircle, Undo2,
} from 'lucide-react'
import Editor from '@monaco-editor/react'
import { useSessionStore } from '../../stores/sessionStore'
import type { Task, DiffResult, FileDiff, DiffHunk } from '../../types'

interface ChangesPanelProps {
  task: Task | null
  diff: DiffResult | null
}

export function ChangesPanel({ task, diff }: ChangesPanelProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [editingFile, setEditingFile] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<{ type: 'hunk' | 'file'; file: string; hunkIndex?: number } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const { acceptHunk, rejectHunk, acceptFile, rejectFile, saveWorkspaceFile } = useSessionStore()

  const isRunning = task?.status === 'running' || task?.status === 'queued'

  // Auto-select first file when diff changes
  useEffect(() => {
    if (diff && diff.files && diff.files.length > 0 && !selectedFile) {
      setSelectedFile(diff.files[0].path)
    }
  }, [diff, selectedFile])

  // Reset selection when task changes
  useEffect(() => {
    setSelectedFile(null)
    setEditingFile(null)
    setRejectTarget(null)
  }, [task?.id])

  const selectedFileDiff = useMemo(
    () => diff?.files?.find((f) => f.path === selectedFile) || null,
    [diff, selectedFile]
  )

  const handleAcceptHunk = async (filePath: string, hunkIndex: number) => {
    if (!task) return
    setActionLoading(true)
    try {
      await acceptHunk(task.id, filePath, hunkIndex)
    } catch (e) {
      console.error('Accept hunk failed:', e)
    } finally {
      setActionLoading(false)
    }
  }

  const handleAcceptFile = async (filePath: string) => {
    if (!task) return
    setActionLoading(true)
    try {
      await acceptFile(task.id, filePath)
    } catch (e) {
      console.error('Accept file failed:', e)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRejectConfirm = async () => {
    if (!task || !rejectTarget) return
    setActionLoading(true)
    try {
      if (rejectTarget.type === 'hunk' && rejectTarget.hunkIndex !== undefined) {
        await rejectHunk(task.id, rejectTarget.file, rejectTarget.hunkIndex, rejectReason)
      } else {
        await rejectFile(task.id, rejectTarget.file, rejectReason)
      }
    } catch (e) {
      console.error('Reject failed:', e)
    } finally {
      setActionLoading(false)
      setRejectTarget(null)
      setRejectReason('')
    }
  }

  const startEditing = async (filePath: string) => {
    if (!task) return
    setEditLoading(true)
    try {
      const content = await window.go.main.App.ReadProjectFile(task.id, filePath)
      setEditContent(content)
      setEditingFile(filePath)
    } catch (e) {
      console.error('Failed to load file:', e)
    } finally {
      setEditLoading(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!task || !editingFile) return
    setActionLoading(true)
    try {
      await saveWorkspaceFile(task.id, editingFile, editContent)
      setEditingFile(null)
    } catch (e) {
      console.error('Save failed:', e)
    } finally {
      setActionLoading(false)
    }
  }

  if (!task) {
    return (
      <div className="flex-1 flex flex-col bg-zinc-900 rounded-lg border border-zinc-800">
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
          Select a task to view changes
        </div>
      </div>
    )
  }

  if (!diff || diff.total === 0) {
    return (
      <div className="flex-1 flex flex-col bg-zinc-900 rounded-lg border border-zinc-800">
        <div className="px-3 py-2 border-b border-zinc-800">
          <span className="text-xs font-medium text-zinc-400">Changes</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 text-sm gap-2">
          <FileCode size={20} />
          <span>{isRunning ? 'Waiting for changes...' : 'No changes detected'}</span>
          {isRunning && <Loader2 size={14} className="animate-spin text-blue-400" />}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-zinc-900 rounded-lg border border-zinc-800 min-h-0">
      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-400">
            {diff.total} file{diff.total !== 1 ? 's' : ''} changed
          </span>
          {isRunning && (
            <span className="flex items-center gap-1 text-[10px] text-blue-400">
              <Loader2 size={10} className="animate-spin" />
              Live
            </span>
          )}
        </div>
      </div>

      {/* Split: file list + diff viewer */}
      <div className="flex-1 flex min-h-0">
        {/* File list */}
        <div className="w-[140px] flex-shrink-0 border-r border-zinc-800 overflow-auto">
          {diff.files.map((f) => (
            <button
              key={f.path}
              onClick={() => { setSelectedFile(f.path); setEditingFile(null) }}
              className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-xs transition-colors ${
                f.path === selectedFile
                  ? 'bg-zinc-800 text-zinc-200'
                  : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
              }`}
            >
              <FileStatusIcon status={f.status} />
              <span className="truncate flex-1" title={f.path}>
                {f.path.split('/').pop()}
              </span>
            </button>
          ))}
        </div>

        {/* Diff viewer / Editor */}
        <div className="flex-1 overflow-auto min-w-0">
          {editingFile ? (
            <InlineEditor
              filePath={editingFile}
              content={editContent}
              loading={editLoading}
              saving={actionLoading}
              onChange={setEditContent}
              onSave={handleSaveEdit}
              onCancel={() => setEditingFile(null)}
            />
          ) : selectedFileDiff ? (
            <DiffViewer
              file={selectedFileDiff}
              disabled={actionLoading}
              onAcceptHunk={(idx) => handleAcceptHunk(selectedFileDiff.path, idx)}
              onRejectHunk={(idx) => {
                setRejectTarget({ type: 'hunk', file: selectedFileDiff.path, hunkIndex: idx })
                setRejectReason('')
              }}
              onAcceptFile={() => handleAcceptFile(selectedFileDiff.path)}
              onRejectFile={() => {
                setRejectTarget({ type: 'file', file: selectedFileDiff.path })
                setRejectReason('')
              }}
              onEditFile={() => startEditing(selectedFileDiff.path)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
              Select a file to view changes
            </div>
          )}
        </div>
      </div>

      {/* Reject reason modal */}
      {rejectTarget && (
        <div className="border-t border-zinc-800 px-3 py-2 flex-shrink-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Undo2 size={12} className="text-red-400" />
            <span className="text-xs text-zinc-300">
              Reject {rejectTarget.type === 'hunk' ? 'hunk' : 'file'}: {rejectTarget.file.split('/').pop()}
            </span>
          </div>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain why this change should be reverted (sent to agent)..."
            className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 resize-none"
            rows={2}
            autoFocus
          />
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={handleRejectConfirm}
              disabled={actionLoading}
              className="flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors disabled:opacity-50"
            >
              {actionLoading ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />}
              Revert & Explain
            </button>
            <button
              onClick={() => { setRejectTarget(null); setRejectReason('') }}
              className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────

function FileStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'added':
      return <FilePlus size={12} className="text-emerald-400 flex-shrink-0" />
    case 'deleted':
      return <FileX size={12} className="text-red-400 flex-shrink-0" />
    default:
      return <FileCode size={12} className="text-amber-400 flex-shrink-0" />
  }
}

interface DiffViewerProps {
  file: FileDiff
  disabled: boolean
  onAcceptHunk: (hunkIndex: number) => void
  onRejectHunk: (hunkIndex: number) => void
  onAcceptFile: () => void
  onRejectFile: () => void
  onEditFile: () => void
}

function DiffViewer({ file, disabled, onAcceptHunk, onRejectHunk, onAcceptFile, onRejectFile, onEditFile }: DiffViewerProps) {
  return (
    <div className="p-2 space-y-2">
      {/* File header */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-2 min-w-0">
          <FileStatusIcon status={file.status} />
          <span className="text-xs font-mono text-zinc-300 truncate">{file.path}</span>
          <StatusBadge status={file.status} />
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onEditFile}
            disabled={disabled}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"
            title="Edit file"
          >
            <Pencil size={10} /> Edit
          </button>
          <button
            onClick={onAcceptFile}
            disabled={disabled}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-emerald-400 hover:bg-emerald-900/30 rounded transition-colors disabled:opacity-50"
            title="Accept all changes in file"
          >
            <CheckCircle size={10} /> Accept All
          </button>
          <button
            onClick={onRejectFile}
            disabled={disabled}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
            title="Reject all changes in file"
          >
            <XCircle size={10} /> Reject All
          </button>
        </div>
      </div>

      {/* Hunks */}
      {file.hunks && file.hunks.length > 0 ? (
        file.hunks.map((hunk) => (
          <HunkBlock
            key={hunk.index}
            hunk={hunk}
            disabled={disabled}
            onAccept={() => onAcceptHunk(hunk.index)}
            onReject={() => onRejectHunk(hunk.index)}
          />
        ))
      ) : file.diff ? (
        // Fallback: show raw diff if no hunks parsed
        <pre className="text-[11px] font-mono text-zinc-500 whitespace-pre-wrap p-2 bg-zinc-800/30 rounded overflow-x-auto">
          {file.diff}
        </pre>
      ) : (
        <div className="text-xs text-zinc-600 px-2 py-4 text-center">
          {file.status === 'deleted' ? 'File was deleted' : 'No diff content available'}
        </div>
      )}
    </div>
  )
}

function HunkBlock({ hunk, disabled, onAccept, onReject }: {
  hunk: DiffHunk
  disabled: boolean
  onAccept: () => void
  onReject: () => void
}) {
  const lines = hunk.content.split('\n')

  return (
    <div className="border border-zinc-800 rounded overflow-hidden">
      {/* Hunk header */}
      <div className="flex items-center justify-between bg-zinc-800/50 px-3 py-1">
        <span className="text-[10px] font-mono text-zinc-500 truncate">{hunk.header}</span>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={onAccept}
            disabled={disabled}
            className="p-1 hover:bg-emerald-900/50 rounded transition-colors disabled:opacity-50"
            title="Accept this hunk"
          >
            <Check size={12} className="text-emerald-400" />
          </button>
          <button
            onClick={onReject}
            disabled={disabled}
            className="p-1 hover:bg-red-900/50 rounded transition-colors disabled:opacity-50"
            title="Reject this hunk"
          >
            <X size={12} className="text-red-400" />
          </button>
        </div>
      </div>

      {/* Diff lines */}
      <div className="overflow-x-auto">
        <pre className="text-[11px] font-mono leading-[1.4]">
          {lines.map((line, i) => {
            if (!line && i === lines.length - 1) return null // skip trailing empty
            const isAdd = line.startsWith('+')
            const isRemove = line.startsWith('-')
            return (
              <div
                key={i}
                className={
                  isAdd
                    ? 'bg-emerald-950/30 text-emerald-300'
                    : isRemove
                    ? 'bg-red-950/30 text-red-300'
                    : 'text-zinc-500'
                }
              >
                <span className="inline-block w-6 text-right pr-1 select-none text-zinc-600 text-[10px]">
                  {isAdd ? '+' : isRemove ? '-' : ' '}
                </span>
                <span className="px-1">{line.length > 0 ? line.substring(1) : ' '}</span>
              </div>
            )
          })}
        </pre>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    added: 'text-emerald-400 bg-emerald-900/30',
    modified: 'text-amber-400 bg-amber-900/30',
    deleted: 'text-red-400 bg-red-900/30',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] ${styles[status] || styles.modified}`}>
      {status}
    </span>
  )
}

// ─── Inline Editor ───────────────────────────────────

function InlineEditor({ filePath, content, loading, saving, onChange, onSave, onCancel }: {
  filePath: string
  content: string
  loading: boolean
  saving: boolean
  onChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  const lang = inferLanguage(filePath)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={16} className="animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 flex-shrink-0">
        <span className="text-xs font-mono text-zinc-400 truncate">{filePath}</span>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onCancel}
            className="px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
            Save
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          theme="vs-dark"
          language={lang}
          value={content}
          onChange={(val) => onChange(val || '')}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            renderWhitespace: 'selection',
            tabSize: 2,
          }}
        />
      </div>
    </div>
  )
}

function inferLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    go: 'go', py: 'python', rs: 'rust',
    json: 'json', yaml: 'yaml', yml: 'yaml',
    md: 'markdown', css: 'css', html: 'html',
    sql: 'sql', sh: 'shell', bash: 'shell',
  }
  return map[ext || ''] || 'plaintext'
}
