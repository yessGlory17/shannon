import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, Square, Loader2, MessageSquare, GitCompare, CheckCircle } from 'lucide-react'
import { useSessionStore } from '../stores/sessionStore'
import { useAgentStore } from '../stores/agentStore'
import { useTeamStore } from '../stores/teamStore'
import { useProjectStore } from '../stores/projectStore'
import { useWailsEvent } from '../hooks/useWailsEvent'
import { DAGView } from '../components/session/DAGView'
import { ChatPanel } from '../components/session/ChatPanel'
import { ChangesPanel } from '../components/session/ChangesPanel'
import type { TaskStreamEvent, DiffResult } from '../types'

export function SessionWorkspace() {
  const { id: sessionID } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    currentSession, tasks, logs, diffs,
    fetchTasks, setCurrentSession, startSession, stopSession, completeSession, refreshTask,
    appendLog, setDiff, loadSessionEvents,
  } = useSessionStore()
  const { agents, fetch: fetchAgents } = useAgentStore()
  const { teams, fetch: fetchTeams } = useTeamStore()
  const { projects, fetch: fetchProjects } = useProjectStore()

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'chat' | 'changes'>('chat')

  // Load initial data
  useEffect(() => {
    if (sessionID) {
      fetchTasks(sessionID)
      fetchAgents()
      fetchTeams()
      fetchProjects()
      try { window.go.main.App.GetSession(sessionID).then(setCurrentSession).catch(console.error) } catch {}
      loadSessionEvents(sessionID)
    }
  }, [sessionID, fetchTasks, fetchAgents, fetchTeams, fetchProjects, setCurrentSession, loadSessionEvents])

  // Polling fallback
  useEffect(() => {
    if (!sessionID) return
    const interval = setInterval(() => {
      fetchTasks(sessionID)
      try { window.go.main.App.GetSession(sessionID).then(setCurrentSession).catch(console.error) } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [sessionID, fetchTasks, setCurrentSession])

  // Task stream events
  useWailsEvent<TaskStreamEvent>('task:stream', (event) => {
    if (event?.task_id) {
      appendLog(event.task_id, event)
    }
  })

  // Task status changes
  useWailsEvent<{ task_id: string; status: string }>('task:status', (event) => {
    if (event?.task_id) {
      refreshTask(event.task_id)
    }
  })

  // Diff events
  useWailsEvent<{ task_id: string; diff: DiffResult }>('task:diff', (event) => {
    if (event?.task_id && event?.diff) {
      setDiff(event.task_id, event.diff)
    }
  })

  // Session status events
  useWailsEvent<{ session_id: string; status: string }>('session:status', () => {
    if (sessionID) {
      fetchTasks(sessionID)
      try { window.go.main.App.GetSession(sessionID).then(setCurrentSession).catch(console.error) } catch {}
    }
  })

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null
  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const failedCount = tasks.filter((t) => t.status === 'failed').length
  const isRunning = currentSession?.status === 'running'
  const hasActiveTasks = tasks.some((t) => t.status === 'running' || t.status === 'queued' || t.status === 'pending')
  const allTasksDone = tasks.length > 0 && !hasActiveTasks

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/sessions/${sessionID}`)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
            title="Back to planner"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold font-display text-zinc-100">
              {currentSession?.name || 'Workspace'}
            </h1>
            <p className="text-xs text-zinc-500">
              {completedCount}/{tasks.length} tasks
              {failedCount > 0 && (
                <span className="text-red-400 ml-1">({failedCount} failed)</span>
              )}
              {isRunning && !allTasksDone && (
                <span className="inline-flex items-center gap-1 ml-2 text-brand-blue">
                  <Loader2 size={10} className="animate-spin" />
                  Running
                </span>
              )}
              {isRunning && allTasksDone && (
                <span className="inline-flex items-center gap-1 ml-2 text-emerald-400">
                  <CheckCircle size={10} />
                  Waiting
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={() => sessionID && startSession(sessionID)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-gradient hover:opacity-90 text-white text-sm font-medium rounded-lg transition-all shadow-brand-sm"
            >
              <Play size={14} />
              Start
            </button>
          ) : (
            <>
              {allTasksDone && (
                <button
                  onClick={() => sessionID && completeSession(sessionID)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <CheckCircle size={14} />
                  Complete
                </button>
              )}
              <button
                onClick={() => sessionID && stopSession(sessionID)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
              >
                <Square size={14} />
                Stop
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main: DAG + Tabbed Panel */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* DAG View (left) */}
        <div className="flex-1 min-w-0 flex flex-col">
          <DAGView
            tasks={tasks}
            agents={agents}
            teams={teams}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
          />
        </div>

        {/* Tabbed Panel (right) */}
        <div className="w-[520px] flex-shrink-0 flex flex-col min-h-0">
          {/* Tab header */}
          <div className="flex bg-[#111114] rounded-t-xl border border-b-0 border-white/[0.06]">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors relative ${
                activeTab === 'chat'
                  ? 'text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <MessageSquare size={13} />
              Chat
              {activeTab === 'chat' && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand-gradient rounded-t" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('changes')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors relative ${
                activeTab === 'changes'
                  ? 'text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <GitCompare size={13} />
              Changes
              {selectedTask && diffs[selectedTask.id]?.total > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-amber-600/20 text-amber-400 rounded-full text-[10px] leading-none">
                  {diffs[selectedTask.id].total}
                </span>
              )}
              {activeTab === 'changes' && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand-gradient rounded-t" />
              )}
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 flex flex-col [&>div]:rounded-t-none">
            {activeTab === 'chat' ? (
              <ChatPanel
                task={selectedTask}
                agents={agents}
                teams={teams}
                sessionId={sessionID || ''}
              />
            ) : (
              <ChangesPanel
                task={selectedTask}
                diff={selectedTask ? (diffs[selectedTask.id] || null) : null}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
