import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Play, Clock, Check, X, Loader2, Trash2, Pause } from 'lucide-react'
import { useSessionStore } from '../stores/sessionStore'
import { useProjectStore } from '../stores/projectStore'
import type { SessionStatus } from '../types'

const statusConfig: Record<SessionStatus, { icon: JSX.Element; label: string; color: string }> = {
  planning: { icon: <Clock size={14} />, label: 'Planning', color: 'text-zinc-400' },
  running: { icon: <Loader2 size={14} className="animate-spin" />, label: 'Running', color: 'text-blue-400' },
  paused: { icon: <Pause size={14} />, label: 'Paused', color: 'text-amber-400' },
  completed: { icon: <Check size={14} />, label: 'Completed', color: 'text-emerald-400' },
  failed: { icon: <X size={14} />, label: 'Failed', color: 'text-red-400' },
}

export function SessionList() {
  const navigate = useNavigate()
  const { sessions, loading, fetchSessions, createSession } = useSessionStore()
  const { projects, fetch: fetchProjects } = useProjectStore()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [projectId, setProjectId] = useState('')

  useEffect(() => {
    fetchSessions()
    fetchProjects()
  }, [fetchSessions, fetchProjects])

  const handleCreate = async () => {
    if (!name.trim() || !projectId) return
    try {
      const sess = await createSession({ name: name.trim(), project_id: projectId, status: 'planning' })
      setName('')
      setProjectId('')
      setShowForm(false)
      navigate(`/sessions/${sess.id}`)
    } catch (e) {
      console.error('Failed to create session:', e)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await window.go.main.App.DeleteSession(id)
      fetchSessions()
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }

  const getProjectName = (id: string) => {
    return projects.find((p) => p.id === id)?.name || id.slice(0, 8)
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Sessions</h1>
          <p className="text-sm text-zinc-500 mt-1">Create and manage work sessions</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-900 text-sm font-medium rounded-md transition-colors"
        >
          <Plus size={16} />
          New Session
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 mb-6">
          <h2 className="text-sm font-medium text-zinc-200 mb-4">New Session</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Session Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Add authentication system"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
              >
                <option value="">Select a project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCreate}
                disabled={!name.trim() || !projectId}
                className="px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-900 text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create & Open
              </button>
              <button
                onClick={() => { setShowForm(false); setName(''); setProjectId('') }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="text-zinc-500 animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12">
          <Play size={32} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-sm text-zinc-500">No sessions yet</p>
          <p className="text-xs text-zinc-600 mt-1">Create a session to start working on tasks</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((sess) => {
            const cfg = statusConfig[sess.status]
            return (
              <div
                key={sess.id}
                onClick={() => navigate(`/sessions/${sess.id}`)}
                className="w-full flex items-center gap-4 px-5 py-4 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 text-left transition-colors group cursor-pointer"
              >
                <div className={cfg.color}>{cfg.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{sess.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {getProjectName(sess.project_id)} &middot; {cfg.label}
                  </p>
                </div>
                <span className="text-xs text-zinc-600">
                  {new Date(sess.created_at).toLocaleDateString()}
                </span>
                <button
                  onClick={(e) => handleDelete(sess.id, e)}
                  className="p-1.5 rounded text-zinc-600 hover:text-red-400 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
