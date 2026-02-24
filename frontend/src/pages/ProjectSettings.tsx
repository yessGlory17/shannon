import { useEffect, useState } from 'react'
import { Plus, Trash2, FolderOpen, Loader2, Pencil, Settings } from 'lucide-react'
import { useProjectStore } from '../stores/projectStore'
import { ProjectSetupWizard } from '../components/projects/ProjectSetupWizard'
import type { Project, ProjectSetupStatus } from '../types'

const emptyForm = { name: '', path: '', test_command: '', build_command: '', setup_command: '' }

export function ProjectSettings() {
  const { projects, loading, fetch, create, update, remove, selectFolder } = useProjectStore()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [setupStatus, setSetupStatus] = useState<ProjectSetupStatus | null>(null)
  const [showSetup, setShowSetup] = useState(false)
  const [checkingSetup, setCheckingSetup] = useState(false)

  // Edit state
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editForm, setEditForm] = useState({ ...emptyForm })
  const [editSetupStatus, setEditSetupStatus] = useState<ProjectSetupStatus | null>(null)
  const [showEditSetup, setShowEditSetup] = useState(false)
  const [checkingEditSetup, setCheckingEditSetup] = useState(false)

  useEffect(() => {
    fetch()
  }, [fetch])

  // ─── Create flow ──────────────────────────────────

  const handleSelectFolder = async () => {
    try {
      const path = await selectFolder()
      if (path) {
        const name = path.split('/').pop() || 'project'
        setForm((f) => ({ ...f, path, name }))

        // Check project setup status
        setCheckingSetup(true)
        setShowForm(false)
        setShowSetup(false)
        try {
          const status = await window.go.main.App.CheckProjectSetup(path)
          setSetupStatus(status)
          if (status.is_ready) {
            setShowForm(true)
          } else {
            setShowSetup(true)
          }
        } catch (e) {
          console.error('Setup check failed:', e)
          setShowForm(true)
        } finally {
          setCheckingSetup(false)
        }
      }
    } catch (e) {
      console.error('Failed to select folder:', e)
    }
  }

  const handleSetupComplete = () => {
    setShowSetup(false)
    setSetupStatus(null)
    setShowForm(true)
  }

  const handleSetupSkip = () => {
    setShowSetup(false)
    setSetupStatus(null)
    setShowForm(true)
  }

  const handleCreate = async () => {
    if (!form.path) return
    await create(form as unknown as Partial<Project>)
    setForm({ ...emptyForm })
    setShowForm(false)
  }

  const handleCancel = () => {
    setShowForm(false)
    setShowSetup(false)
    setSetupStatus(null)
    setCheckingSetup(false)
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
      setup_command: project.setup_command || '',
    })
    // Close create form if open
    setShowForm(false)
    setShowSetup(false)
    setShowEditSetup(false)
  }

  const handleUpdate = async () => {
    if (!editingProject) return
    await update({
      ...editingProject,
      name: editForm.name,
      path: editForm.path,
      test_command: editForm.test_command,
      build_command: editForm.build_command,
      setup_command: editForm.setup_command,
    })
    setEditingProject(null)
    setEditForm({ ...emptyForm })
  }

  const cancelEditing = () => {
    setEditingProject(null)
    setEditForm({ ...emptyForm })
    setShowEditSetup(false)
    setEditSetupStatus(null)
  }

  const handleRerunSetup = async () => {
    if (!editForm.path) return
    setCheckingEditSetup(true)
    try {
      const status = await window.go.main.App.CheckProjectSetup(editForm.path)
      setEditSetupStatus(status)
      setShowEditSetup(true)
    } catch (e) {
      console.error('Setup check failed:', e)
    } finally {
      setCheckingEditSetup(false)
    }
  }

  const handleEditSetupComplete = () => {
    setShowEditSetup(false)
    setEditSetupStatus(null)
  }

  const handleEditSetupSkip = () => {
    setShowEditSetup(false)
    setEditSetupStatus(null)
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Projects</h1>
        <button
          onClick={handleSelectFolder}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md transition-colors"
        >
          <Plus size={16} />
          Add Project
        </button>
      </div>

      {/* Checking setup spinner */}
      {checkingSetup && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 mb-6 flex items-center gap-3">
          <Loader2 size={16} className="animate-spin text-blue-400" />
          <p className="text-sm text-zinc-400">Checking project setup...</p>
        </div>
      )}

      {/* Setup Wizard (create) */}
      {showSetup && setupStatus && (
        <div className="mb-6">
          <ProjectSetupWizard
            path={form.path}
            status={setupStatus}
            onComplete={handleSetupComplete}
            onSkip={handleSetupSkip}
          />
        </div>
      )}

      {/* Project creation form */}
      {showForm && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 mb-6">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">New Project</h2>
          <ProjectForm
            form={form}
            onChange={setForm}
            onSelectFolder={handleSelectFolder}
            pathReadOnly
          />
          <div className="flex gap-2 pt-4">
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md transition-colors"
            >
              Create
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <FolderOpen size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">No projects yet. Add a project folder to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p) =>
            editingProject?.id === p.id ? (
              <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <h2 className="text-sm font-medium text-zinc-300 mb-4">Edit Project</h2>

                {/* Edit Setup Wizard */}
                {showEditSetup && editSetupStatus ? (
                  <div className="mb-4">
                    <ProjectSetupWizard
                      path={editForm.path}
                      status={editSetupStatus}
                      onComplete={handleEditSetupComplete}
                      onSkip={handleEditSetupSkip}
                    />
                  </div>
                ) : (
                  <>
                    <ProjectForm
                      form={editForm}
                      onChange={setEditForm}
                      pathReadOnly
                    />
                    <div className="mt-3">
                      <button
                        onClick={handleRerunSetup}
                        disabled={checkingEditSetup}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors disabled:opacity-50"
                      >
                        {checkingEditSetup ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Settings size={12} />
                        )}
                        Re-run Project Setup
                      </button>
                    </div>
                  </>
                )}

                <div className="flex gap-2 pt-4 border-t border-zinc-800 mt-4">
                  <button
                    onClick={handleUpdate}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={p.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-zinc-200">{p.name}</h3>
                  <p className="text-xs text-zinc-500 font-mono mt-0.5 truncate">{p.path}</p>
                  {(p.test_command || p.build_command || p.setup_command) && (
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
                      {p.setup_command && (
                        <span className="text-xs text-zinc-500">
                          setup: <code className="text-zinc-400">{p.setup_command}</code>
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEditing(p)}
                    className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    title="Edit project"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => remove(p.id)}
                    className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                    title="Delete project"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ─── Shared form component ──────────────────────────

type ProjectFormData = { name: string; path: string; test_command: string; build_command: string; setup_command: string }

interface ProjectFormProps {
  form: ProjectFormData
  onChange: (updater: (prev: ProjectFormData) => ProjectFormData) => void
  onSelectFolder?: () => void
  pathReadOnly?: boolean
}

function ProjectForm({ form, onChange, onSelectFolder, pathReadOnly }: ProjectFormProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Name</label>
        <input
          value={form.name}
          onChange={(e) => onChange((f) => ({ ...f, name: e.target.value }))}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Path</label>
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
          <label className="block text-xs text-zinc-500 mb-1">Test Command</label>
          <input
            value={form.test_command}
            onChange={(e) => onChange((f) => ({ ...f, test_command: e.target.value }))}
            placeholder="go test ./..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Build Command</label>
          <input
            value={form.build_command}
            onChange={(e) => onChange((f) => ({ ...f, build_command: e.target.value }))}
            placeholder="go build ./..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-zinc-500 mb-1">
          Setup Command <span className="text-zinc-600">(runs after each workspace is created)</span>
        </label>
        <input
          value={form.setup_command}
          onChange={(e) => onChange((f) => ({ ...f, setup_command: e.target.value }))}
          placeholder="e.g. wt-sync .env .env.local"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
        />
      </div>
    </div>
  )
}
