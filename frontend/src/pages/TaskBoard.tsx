import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Plus, Trash2, Play, ArrowLeft, Wand2, Loader2,
  GripVertical, ChevronDown, ChevronUp, Bot,
} from 'lucide-react'
import { useSessionStore } from '../stores/sessionStore'
import { useAgentStore } from '../stores/agentStore'
import { useProjectStore } from '../stores/projectStore'
import type { Task, ProposedTask, Agent } from '../types'

export function TaskBoard() {
  const { id: sessionID } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    currentSession, tasks, fetchTasks, setCurrentSession,
    createTask, updateTask, deleteTask, startSession,
  } = useSessionStore()
  const { agents, fetch: fetchAgents } = useAgentStore()
  const { projects, fetch: fetchProjects } = useProjectStore()

  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [agentId, setAgentId] = useState('')
  const [deps, setDeps] = useState<string[]>([])

  // Planner state
  const [showPlanner, setShowPlanner] = useState(false)
  const [goal, setGoal] = useState('')
  const [planning, setPlanning] = useState(false)
  const [proposedTasks, setProposedTasks] = useState<ProposedTask[]>([])
  const [planSummary, setPlanSummary] = useState('')

  const [expandedTask, setExpandedTask] = useState<string | null>(null)

  useEffect(() => {
    if (sessionID) {
      fetchTasks(sessionID)
      fetchAgents()
      fetchProjects()
      // Load session info
      window.go.main.App.GetSession(sessionID).then(setCurrentSession).catch(console.error)
    }
  }, [sessionID, fetchTasks, fetchAgents, fetchProjects, setCurrentSession])

  const project = projects.find((p) => p.id === currentSession?.project_id)

  const resetForm = () => {
    setTitle('')
    setPrompt('')
    setAgentId('')
    setDeps([])
    setEditingTask(null)
    setShowForm(false)
  }

  const handleCreateTask = async () => {
    if (!sessionID || !title.trim() || !prompt.trim()) return
    try {
      if (editingTask) {
        await updateTask({
          ...editingTask,
          title: title.trim(),
          prompt: prompt.trim(),
          agent_id: agentId || undefined,
          dependencies: deps,
        })
      } else {
        await createTask({
          session_id: sessionID,
          title: title.trim(),
          prompt: prompt.trim(),
          status: 'pending',
          agent_id: agentId || undefined,
          dependencies: deps,
        })
      }
      resetForm()
    } catch (e) {
      console.error('Failed to create/update task:', e)
    }
  }

  const handleEditTask = (task: Task) => {
    setTitle(task.title)
    setPrompt(task.prompt)
    setAgentId(task.agent_id || '')
    setDeps(task.dependencies || [])
    setEditingTask(task)
    setShowForm(true)
  }

  const handleDeleteTask = async (id: string) => {
    try {
      await deleteTask(id)
    } catch (e) {
      console.error('Failed to delete task:', e)
    }
  }

  // Planner
  const handlePlan = async () => {
    if (!currentSession?.project_id || !goal.trim()) return
    setPlanning(true)
    setProposedTasks([])
    setPlanSummary('')
    try {
      const result = await window.go.main.App.PlanTasks(currentSession.project_id, goal.trim())
      setProposedTasks(result.tasks || [])
      setPlanSummary(result.summary || '')
    } catch (e) {
      console.error('Planning failed:', e)
    } finally {
      setPlanning(false)
    }
  }

  const handleAcceptPlan = async () => {
    if (!sessionID) return
    // Create tasks from proposed plan
    for (const proposed of proposedTasks) {
      // Resolve dependency titles to actual task IDs
      const depIds: string[] = []
      // For now, dependencies reference titles - we map them after creation
      await createTask({
        session_id: sessionID,
        title: proposed.title,
        prompt: proposed.prompt,
        status: 'pending',
        agent_id: proposed.agent_id || agentId || undefined,
        dependencies: depIds,
      })
    }
    // After all tasks created, resolve title-based dependencies
    const freshTasks = await window.go.main.App.ListTasks(sessionID)
    for (const proposed of proposedTasks) {
      if (proposed.dependencies && proposed.dependencies.length > 0) {
        const task = freshTasks.find((t: Task) => t.title === proposed.title)
        if (!task) continue
        const resolvedDeps = proposed.dependencies
          .map((depTitle: string) => freshTasks.find((t: Task) => t.title === depTitle)?.id)
          .filter(Boolean) as string[]
        if (resolvedDeps.length > 0) {
          await updateTask({ ...task, dependencies: resolvedDeps })
        }
      }
    }
    await fetchTasks(sessionID)
    setProposedTasks([])
    setPlanSummary('')
    setGoal('')
    setShowPlanner(false)
  }

  const handleStartSession = async () => {
    if (!sessionID) return
    try {
      await startSession(sessionID)
      navigate(`/monitor/${sessionID}`)
    } catch (e) {
      console.error('Failed to start session:', e)
    }
  }

  const getAgentName = (id?: string) => {
    if (!id) return 'Unassigned'
    return agents.find((a: Agent) => a.id === id)?.name || id.slice(0, 8)
  }

  const toggleDep = (taskId: string) => {
    setDeps((prev) =>
      prev.includes(taskId) ? prev.filter((d) => d !== taskId) : [...prev, taskId]
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/sessions')}
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">
              {currentSession?.name || 'Task Board'}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {project?.name || 'Unknown project'} &middot; {tasks.length} tasks
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPlanner(true)}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-600/30 text-sm rounded-md transition-colors"
          >
            <Wand2 size={14} />
            AI Planner
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm rounded-md transition-colors"
          >
            <Plus size={14} />
            Add Task
          </button>
          {tasks.length > 0 && (
            <button
              onClick={handleStartSession}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-md transition-colors"
            >
              <Play size={14} />
              Start Execution
            </button>
          )}
        </div>
      </div>

      {/* AI Planner Dialog */}
      {showPlanner && (
        <div className="bg-zinc-900 border border-purple-600/30 rounded-lg p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <Wand2 size={16} className="text-purple-400" />
            <h2 className="text-sm font-medium text-purple-300">AI Task Planner</h2>
          </div>
          {proposedTasks.length === 0 ? (
            <>
              <p className="text-xs text-zinc-500 mb-3">
                Describe your goal and the AI will analyze the project and propose a task breakdown.
              </p>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Add JWT authentication with login and registration endpoints, middleware protection, and unit tests"
                rows={3}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-purple-600/50 resize-none"
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handlePlan}
                  disabled={planning || !goal.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {planning ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  {planning ? 'Analyzing...' : 'Generate Plan'}
                </button>
                <button
                  onClick={() => { setShowPlanner(false); setGoal('') }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {planSummary && (
                <p className="text-sm text-zinc-300 mb-4 bg-zinc-800/50 px-3 py-2 rounded-md">
                  {planSummary}
                </p>
              )}
              <div className="space-y-2 mb-4">
                {proposedTasks.map((pt, i) => (
                  <div key={i} className="bg-zinc-800 border border-zinc-700 rounded-md p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-zinc-600 font-mono w-5">{i + 1}.</span>
                      <span className="text-sm font-medium text-zinc-200">{pt.title}</span>
                    </div>
                    <p className="text-xs text-zinc-400 ml-7 line-clamp-2">{pt.prompt}</p>
                    {pt.dependencies && pt.dependencies.length > 0 && (
                      <p className="text-xs text-zinc-600 ml-7 mt-1">
                        Depends on: {pt.dependencies.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAcceptPlan}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-md transition-colors"
                >
                  Accept & Create Tasks
                </button>
                <button
                  onClick={() => { setProposedTasks([]); setPlanSummary('') }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors"
                >
                  Re-plan
                </button>
                <button
                  onClick={() => { setShowPlanner(false); setProposedTasks([]); setPlanSummary(''); setGoal('') }}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Task form */}
      {showForm && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 mb-5">
          <h2 className="text-sm font-medium text-zinc-200 mb-4">
            {editingTask ? 'Edit Task' : 'New Task'}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Implement login API"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Detailed instructions for the agent..."
                rows={4}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Agent</label>
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
                >
                  <option value="">Auto-assign</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.model})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Dependencies</label>
                <div className="space-y-1 max-h-24 overflow-auto">
                  {tasks.filter((t) => t.id !== editingTask?.id).map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deps.includes(t.id)}
                        onChange={() => toggleDep(t.id)}
                        className="rounded border-zinc-700 bg-zinc-800 text-emerald-500"
                      />
                      {t.title}
                    </label>
                  ))}
                  {tasks.filter((t) => t.id !== editingTask?.id).length === 0 && (
                    <p className="text-xs text-zinc-600">No other tasks yet</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCreateTask}
                disabled={!title.trim() || !prompt.trim()}
                className="px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-900 text-sm font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editingTask ? 'Update' : 'Add Task'}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 overflow-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
              <Plus size={20} className="text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500 mb-1">No tasks yet</p>
            <p className="text-xs text-zinc-600 mb-4">
              Add tasks manually or use the AI Planner to generate them
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPlanner(true)}
                className="flex items-center gap-2 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-600/30 text-xs rounded-md transition-colors"
              >
                <Wand2 size={12} />
                AI Planner
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-md transition-colors"
              >
                <Plus size={12} />
                Manual
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task, index) => {
              const isExpanded = expandedTask === task.id
              const depNames = (task.dependencies || [])
                .map((d) => tasks.find((t) => t.id === d)?.title)
                .filter(Boolean)

              return (
                <div
                  key={task.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <GripVertical size={14} className="text-zinc-700 flex-shrink-0" />
                    <span className="text-xs text-zinc-600 font-mono w-5">{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">{task.title}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-zinc-500">
                          <Bot size={10} />
                          {getAgentName(task.agent_id)}
                        </span>
                        {depNames.length > 0 && (
                          <span className="text-xs text-zinc-600">
                            deps: {depNames.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                        className="p-1.5 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <button
                        onClick={() => handleEditTask(task)}
                        className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1.5 rounded text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-4 pb-3 border-t border-zinc-800/50 pt-3 ml-12">
                      <p className="text-xs text-zinc-400 whitespace-pre-wrap">{task.prompt}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
