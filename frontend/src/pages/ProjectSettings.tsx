import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, FolderOpen, Pencil, FileText, Save, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { useProjectStore } from '../stores/projectStore'
import { Pagination } from '../components/common/Pagination'
import type { Project } from '../types'

const emptyForm = { name: '', path: '', test_command: '', build_command: '', setup_commands: [] as string[] }

export function ProjectSettings() {
  const { projects, loading, pagination, fetchPaginated, create, update, remove, selectFolder } = useProjectStore()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })

  // Edit state
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editForm, setEditForm] = useState({ ...emptyForm })

  // CLAUDE.md state
  const [claudeMdProject, setClaudeMdProject] = useState<string | null>(null)
  const [claudeMdContent, setClaudeMdContent] = useState('')
  const [claudeMdSaving, setClaudeMdSaving] = useState(false)
  const [claudeMdSaved, setClaudeMdSaved] = useState(false)
  const [claudeMdLoading, setClaudeMdLoading] = useState(false)

  const goToPage = useCallback((p: number) => {
    fetchPaginated(p, pagination.pageSize)
  }, [fetchPaginated, pagination.pageSize])

  useEffect(() => {
    fetchPaginated(1)
  }, [fetchPaginated])

  // ─── Create flow ──────────────────────────────────

  const handleSelectFolder = async () => {
    try {
      const path = await selectFolder()
      if (path) {
        const name = path.split('/').pop() || 'project'
        setForm((f) => ({ ...f, path, name }))
        setShowForm(true)
      }
    } catch (e) {
      console.error('Failed to select folder:', e)
    }
  }

  const handleCreate = async () => {
    if (!form.path) return
    await create({
      ...form,
      setup_commands: form.setup_commands.filter(c => c.trim() !== ''),
    } as unknown as Partial<Project>)
    setForm({ ...emptyForm })
    setShowForm(false)
  }

  const handleCancel = () => {
    setShowForm(false)
    setForm({ ...emptyForm })
  }

  // ─── Edit flow ────────────────────────────────────

  const startEditing = (project: Project) => {
    setEditingProject(project)
    setEditForm({
      name: project.name,
      path: project.path,
      test_command: project.test_command || '',
      build_command: project.build_command || '',
      setup_commands: project.setup_commands?.length ? [...project.setup_commands] : [],
    })
    setShowForm(false)
  }

  const handleUpdate = async () => {
    if (!editingProject) return
    await update({
      ...editingProject,
      name: editForm.name,
      path: editForm.path,
      test_command: editForm.test_command,
      build_command: editForm.build_command,
      setup_commands: editForm.setup_commands.filter(c => c.trim() !== ''),
    })
    setEditingProject(null)
    setEditForm({ ...emptyForm })
  }

  const cancelEditing = () => {
    setEditingProject(null)
    setEditForm({ ...emptyForm })
  }

  // CLAUDE.md handlers
  const toggleClaudeMd = async (projectId: string) => {
    if (claudeMdProject === projectId) {
      setClaudeMdProject(null)
      setClaudeMdContent('')
      return
    }
    setClaudeMdLoading(true)
    try {
      const content = await window.go.main.App.GetProjectClaudeMD(projectId)
      setClaudeMdContent(content || '')
      setClaudeMdProject(projectId)
    } catch (e) {
      console.error('Failed to load CLAUDE.md:', e)
    } finally {
      setClaudeMdLoading(false)
    }
  }

  const saveClaudeMd = async () => {
    if (!claudeMdProject) return
    setClaudeMdSaving(true)
    setClaudeMdSaved(false)
    try {
      await window.go.main.App.UpdateProjectClaudeMD(claudeMdProject, claudeMdContent)
      setClaudeMdSaved(true)
      setTimeout(() => setClaudeMdSaved(false), 2000)
    } catch (e) {
      console.error('Failed to save CLAUDE.md:', e)
    } finally {
      setClaudeMdSaving(false)
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-display text-zinc-100">Workspaces</h1>
        <button
          onClick={handleSelectFolder}
          className="flex items-center gap-2 bg-brand-gradient hover:opacity-90 text-white text-sm font-medium rounded-lg px-4 py-2 transition-[color,background-color,border-color,box-shadow,opacity] shadow-brand-sm hover:shadow-brand"
        >
          <Plus size={16} />
          Add Workspace
        </button>
      </div>

      {/* Project creation form */}
      {showForm && (
        <div className="rounded-xl bg-[#111114] border border-white/[0.06] shadow-card p-5 mb-6">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">New Workspace</h2>
          <ProjectForm
            form={form}
            onChange={setForm}
            onSelectFolder={handleSelectFolder}
            pathReadOnly
          />
          <div className="flex gap-2 pt-4">
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-brand-gradient hover:opacity-90 text-white text-sm font-medium rounded-lg transition-[color,background-color,border-color,box-shadow,opacity] shadow-brand-sm hover:shadow-brand"
            >
              Create
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.10] text-zinc-300 text-sm rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : projects.length === 0 && pagination.totalItems === 0 ? (
        <div className="text-center py-12 text-zinc-600">
          <FolderOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No workspaces yet. Add a folder to get started.</p>
        </div>
      ) : (
        <>
        <div className="space-y-2">
          {projects.map((p) =>
            editingProject?.id === p.id ? (
              <div key={p.id} className="rounded-xl bg-[#111114] border border-white/[0.06] shadow-card p-5">
                <h2 className="text-sm font-medium text-zinc-300 mb-4">Edit Workspace</h2>

                <ProjectForm
                  form={editForm}
                  onChange={setEditForm}
                  pathReadOnly
                />

                <div className="flex gap-2 pt-4 border-t border-white/[0.06] mt-4">
                  <button
                    onClick={handleUpdate}
                    className="px-4 py-2 bg-brand-gradient hover:opacity-90 text-white text-sm font-medium rounded-lg transition-[color,background-color,border-color,box-shadow,opacity] shadow-brand-sm hover:shadow-brand"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.10] text-zinc-300 text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={p.id}
                className="rounded-xl bg-[#111114] border border-white/[0.06] shadow-card"
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-zinc-200">{p.name}</h3>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5 truncate">{p.path}</p>
                    {(p.test_command || p.build_command || (p.setup_commands && p.setup_commands.length > 0)) && (
                      <div className="flex gap-3 mt-1.5 flex-wrap">
                        {p.test_command && (
                          <span className="text-xs text-zinc-500">
                            test: <code className="text-zinc-400">{p.test_command}</code>
                          </span>
                        )}
                        {p.build_command && (
                          <span className="text-xs text-zinc-500">
                            build: <code className="text-zinc-400">{p.build_command}</code>
                          </span>
                        )}
                        {p.setup_commands && p.setup_commands.length > 0 && (
                          <span className="text-xs text-zinc-500">
                            setup: <code className="text-zinc-400">{p.setup_commands.length} command{p.setup_commands.length > 1 ? 's' : ''}</code>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleClaudeMd(p.id)}
                      className={`p-2 transition-colors ${claudeMdProject === p.id ? 'text-purple-400' : 'text-zinc-500 hover:text-purple-400'}`}
                      title="CLAUDE.md Memory"
                    >
                      {claudeMdLoading && claudeMdProject === null ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <FileText size={16} />
                      )}
                    </button>
                    <button
                      onClick={() => startEditing(p)}
                      className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      title="Edit workspace"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                      title="Delete workspace"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* CLAUDE.md Editor */}
                {claudeMdProject === p.id && (
                  <div className="px-4 pb-4 border-t border-white/[0.06]">
                    <div className="flex items-center justify-between mt-3 mb-2">
                      <div className="flex items-center gap-2">
                        <FileText size={12} className="text-purple-400" />
                        <span className="text-xs font-medium text-purple-300">CLAUDE.md</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {claudeMdSaved && (
                          <span className="text-xs text-emerald-400">Saved</span>
                        )}
                        <button
                          onClick={saveClaudeMd}
                          disabled={claudeMdSaving}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-medium rounded-lg disabled:opacity-50 transition-colors border border-purple-500/20"
                        >
                          {claudeMdSaving ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            <Save size={10} />
                          )}
                          Save
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-600 mb-2">
                      Persistent context injected into every task workspace as .claude/CLAUDE.md. Claude CLI reads this automatically.
                    </p>
                    <textarea
                      value={claudeMdContent}
                      onChange={(e) => setClaudeMdContent(e.target.value)}
                      placeholder="# Project Context&#10;&#10;Add persistent instructions, coding conventions, architecture notes..."
                      rows={10}
                      className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 input-focus resize-y transition-colors font-mono"
                    />
                  </div>
                )}
              </div>
            )
          )}
        </div>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} totalItems={pagination.totalItems} onPageChange={goToPage} />
        </>
      )}
    </div>
  )
}

// ─── Shared form component ──────────────────────────

type ProjectFormData = { name: string; path: string; test_command: string; build_command: string; setup_commands: string[] }

interface ProjectFormProps {
  form: ProjectFormData
  onChange: (updater: (prev: ProjectFormData) => ProjectFormData) => void
  onSelectFolder?: () => void
  pathReadOnly?: boolean
}

function ProjectForm({ form, onChange, onSelectFolder, pathReadOnly }: ProjectFormProps) {
  const addSetupCommand = () => {
    onChange((f) => ({ ...f, setup_commands: [...f.setup_commands, ''] }))
  }

  const updateSetupCommand = (index: number, value: string) => {
    onChange((f) => {
      const cmds = [...f.setup_commands]
      cmds[index] = value
      return { ...f, setup_commands: cmds }
    })
  }

  const removeSetupCommand = (index: number) => {
    onChange((f) => ({
      ...f,
      setup_commands: f.setup_commands.filter((_, i) => i !== index),
    }))
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-zinc-500 font-medium mb-1.5">Name</label>
        <input
          value={form.name}
          onChange={(e) => onChange((f) => ({ ...f, name: e.target.value }))}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-100 input-focus transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 font-medium mb-1.5">Path</label>
        <div className="flex gap-2">
          <input
            value={form.path}
            readOnly={pathReadOnly}
            className={`flex-1 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm ${
              pathReadOnly ? 'text-zinc-400' : 'text-zinc-200 focus:outline-none focus:border-zinc-600'
            }`}
          />
          {onSelectFolder && (
            <button
              onClick={onSelectFolder}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              <FolderOpen size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-500 font-medium mb-1.5">Test Command</label>
          <input
            value={form.test_command}
            onChange={(e) => onChange((f) => ({ ...f, test_command: e.target.value }))}
            placeholder="go test ./..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 input-focus transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 font-medium mb-1.5">Build Command</label>
          <input
            value={form.build_command}
            onChange={(e) => onChange((f) => ({ ...f, build_command: e.target.value }))}
            placeholder="go build ./..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 input-focus transition-colors"
          />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs text-zinc-500">
            Setup Commands <span className="text-zinc-600">(run after each workspace is created)</span>
          </label>
          <button
            type="button"
            onClick={addSetupCommand}
            className="flex items-center gap-1 px-2 py-0.5 text-xs text-zinc-400 hover:text-zinc-200 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] rounded-lg transition-colors"
          >
            <Plus size={12} />
            Add
          </button>
        </div>
        {form.setup_commands.length === 0 ? (
          <p className="text-xs text-zinc-600 py-2">No setup commands configured.</p>
        ) : (
          <div className="space-y-1.5">
            {form.setup_commands.map((cmd, i) => (
              <div key={i} className="flex gap-1.5">
                <span className="flex-shrink-0 w-5 text-right text-[10px] text-zinc-600 leading-[34px]">{i + 1}</span>
                <input
                  value={cmd}
                  onChange={(e) => updateSetupCommand(i, e.target.value)}
                  placeholder="e.g. cp .env.example .env"
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 input-focus transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => removeSetupCommand(i)}
                  className="p-2 text-zinc-600 hover:text-red-400 transition-colors"
                  title="Remove command"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
