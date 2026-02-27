import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Play, Square, Check, X, Clock, Loader2, ArrowLeft,
  ChevronRight, FileCode, Terminal, TestTube, CheckCircle, XCircle, AlertTriangle,
  MessageCircleQuestion,
} from 'lucide-react'
import { useSessionStore, useTaskLogs, useTaskDiff } from '../stores/sessionStore'
import { useAgentStore } from '../stores/agentStore'
import { useProjectStore } from '../stores/projectStore'
import { useWailsEvent } from '../hooks/useWailsEvent'
import type { TaskStreamEvent, DiffResult, TaskStatus } from '../types'

const statusIcon: Record<TaskStatus, JSX.Element> = {
  pending: <Clock size={14} className="text-zinc-500" />,
  queued: <Loader2 size={14} className="text-amber-400 animate-spin" />,
  running: <Loader2 size={14} className="text-blue-400 animate-spin" />,
  completed: <Check size={14} className="text-emerald-400" />,
  failed: <X size={14} className="text-red-400" />,
  cancelled: <X size={14} className="text-zinc-500" />,
  awaiting_input: <MessageCircleQuestion size={14} className="text-purple-400" />,
}

export function SessionMonitor() {
  const { id: sessionID } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Granular selectors - each selector subscribes only to its slice
  const currentSession = useSessionStore((s) => s.currentSession)
  const tasks = useSessionStore((s) => s.tasks)
  const fetchTasks = useSessionStore((s) => s.fetchTasks)
  const setCurrentSession = useSessionStore((s) => s.setCurrentSession)
  const startSession = useSessionStore((s) => s.startSession)
  const stopSession = useSessionStore((s) => s.stopSession)
  const refreshTask = useSessionStore((s) => s.refreshTask)
  const appendLog = useSessionStore((s) => s.appendLog)
  const setDiff = useSessionStore((s) => s.setDiff)
  const loadSessionEvents = useSessionStore((s) => s.loadSessionEvents)

  const agents = useAgentStore((s) => s.agents)
  const fetchAgents = useAgentStore((s) => s.fetch)
  const fetchProjects = useProjectStore((s) => s.fetch)

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  const isRunning = currentSession?.status === 'running'

  // Task-specific selectors — only re-render when selected task's data changes
  const selectedLogs = useTaskLogs(selectedTaskId ?? undefined)
  const selectedDiff = useTaskDiff(selectedTaskId ?? undefined)

  // Load initial data + buffered events from backend
  useEffect(() => {
    if (sessionID) {
      fetchTasks(sessionID)
      fetchAgents()
      fetchProjects()
      window.go.main.App.GetSession(sessionID).then(setCurrentSession).catch(console.error)
      loadSessionEvents(sessionID)
    }
  }, [sessionID, fetchTasks, fetchAgents, fetchProjects, setCurrentSession, loadSessionEvents])

  // Polling fallback - Wails events handle real-time updates; this is a safety net only
  useEffect(() => {
    if (!sessionID || !isRunning) return
    const interval = setInterval(() => {
      fetchTasks(sessionID)
      window.go.main.App.GetSession(sessionID).then(setCurrentSession).catch(console.error)
    }, 15000)
    return () => clearInterval(interval)
  }, [sessionID, isRunning, fetchTasks, setCurrentSession])

  // Listen for task stream events → store in zustand
  useWailsEvent<TaskStreamEvent>('task:stream', (event) => {
    if (event?.task_id) {
      appendLog(event.task_id, event)
    }
  })

  // Listen for task status changes
  useWailsEvent<{ task_id: string; status: string }>('task:status', (event) => {
    if (sessionID) {
      refreshTask(event.task_id)
    }
  })

  // Listen for diffs → store in zustand
  useWailsEvent<{ task_id: string; diff: DiffResult }>('task:diff', (event) => {
    if (event?.task_id && event?.diff) {
      setDiff(event.task_id, event.diff)
    }
  })

  // Listen for session status
  useWailsEvent<{ session_id: string; status: string }>('session:status', () => {
    if (sessionID) {
      fetchTasks(sessionID)
      window.go.main.App.GetSession(sessionID).then(setCurrentSession).catch(console.error)
    }
  })

  const selectedTask = useMemo(() => tasks.find((t) => t.id === selectedTaskId), [tasks, selectedTaskId])

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [selectedLogs.length, selectedTaskId])

  const completedCount = useMemo(() => tasks.filter((t) => t.status === 'completed').length, [tasks])

  const getAgentName = useCallback((id?: string) => {
    if (!id) return '-'
    return agents.find((a) => a.id === id)?.name || id.slice(0, 8)
  }, [agents])

  const handleApply = async (taskId: string) => {
    try {
      await window.go.main.App.ApplyTaskChanges(taskId)
      refreshTask(taskId)
    } catch (e) {
      console.error('Apply failed:', e)
    }
  }

  const handleReject = async (taskId: string) => {
    try {
      await window.go.main.App.RejectTaskChanges(taskId)
      refreshTask(taskId)
    } catch (e) {
      console.error('Reject failed:', e)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/sessions/${sessionID}`)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold font-display text-zinc-100">
              {currentSession?.name || 'Session'}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {completedCount}/{tasks.length} tasks completed
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={() => sessionID && startSession(sessionID)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-gradient hover:opacity-90 text-white text-sm font-medium rounded-lg transition-opacity shadow-brand-sm"
            >
              <Play size={14} />
              Start
            </button>
          ) : (
            <button
              onClick={() => sessionID && stopSession(sessionID)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
            >
              <Square size={14} />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Task list (left) */}
        <div className="w-64 xl:w-72 flex-shrink-0 rounded-xl bg-[#111114] border border-white/[0.06] overflow-auto">
          <div className="p-3 border-b border-white/[0.06]">
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Tasks</h2>
          </div>
          <div className="p-1.5">
            {tasks.map((task) => (
              <button
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${
                  selectedTaskId === task.id
                    ? 'bg-white/[0.06] text-zinc-100'
                    : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                }`}
              >
                {statusIcon[task.status]}
                <div className="flex-1 min-w-0">
                  <p className="truncate">{task.title}</p>
                  <div className="flex items-center gap-2 text-xs text-zinc-600">
                    <span className="truncate">{getAgentName(task.agent_id)}</span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-zinc-600 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Task detail (right) */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {!selectedTask ? (
            <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
              Select a task to view details
            </div>
          ) : (
            <>
              {/* Live logs */}
              <div className="flex-1 rounded-xl bg-[#111114] border border-white/[0.06] flex flex-col min-h-0">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
                  <Terminal size={14} className="text-zinc-500" />
                  <span className="text-xs font-medium text-zinc-400">Live Output</span>
                  {selectedTask.status === 'running' && (
                    <Loader2 size={12} className="text-brand-blue animate-spin ml-auto" />
                  )}
                </div>
                <VirtualizedLogs logs={selectedLogs} logEndRef={logEndRef} />
              </div>

              {/* Error message for failed tasks */}
              {selectedTask.status === 'failed' && selectedTask.error && (
                <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className="text-red-400" />
                    <span className="text-xs font-medium text-red-400">Task Failed</span>
                  </div>
                  <pre className="text-xs text-red-300/80 font-mono whitespace-pre-wrap break-all">
                    {selectedTask.error}
                  </pre>
                </div>
              )}

              {/* Diff + Test results */}
              {selectedTask.status === 'completed' && (
                <div className="flex gap-3">
                  {/* Diff */}
                  {selectedDiff && selectedDiff.total > 0 && (
                    <div className="flex-1 rounded-xl bg-[#111114] border border-white/[0.06] max-h-48 overflow-auto">
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
                        <FileCode size={14} className="text-zinc-500" />
                        <span className="text-xs font-medium text-zinc-400">
                          Changes ({selectedDiff.total} files)
                        </span>
                      </div>
                      <div className="p-3 space-y-1">
                        {selectedDiff.files.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className={
                              f.status === 'added' ? 'text-emerald-400' :
                              f.status === 'deleted' ? 'text-red-400' :
                              'text-amber-400'
                            }>
                              {f.status === 'added' ? '+' : f.status === 'deleted' ? '-' : '~'}
                            </span>
                            <span className="text-zinc-300 font-mono">{f.path}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Test results */}
                  {selectedTask.test_passed !== undefined && (
                    <div className="w-64 rounded-xl bg-[#111114] border border-white/[0.06]">
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
                        <TestTube size={14} className="text-zinc-500" />
                        <span className="text-xs font-medium text-zinc-400">Tests</span>
                        {selectedTask.test_passed ? (
                          <CheckCircle size={14} className="text-emerald-400 ml-auto" />
                        ) : (
                          <XCircle size={14} className="text-red-400 ml-auto" />
                        )}
                      </div>
                      <div className="p-3">
                        <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap max-h-24 overflow-auto">
                          {selectedTask.test_output || 'No output'}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Apply/Reject buttons */}
              {selectedTask.status === 'completed' && selectedDiff && selectedDiff.total > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApply(selectedTask.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-gradient hover:opacity-90 text-white text-sm font-medium rounded-lg transition-opacity shadow-brand-sm"
                  >
                    <Check size={14} />
                    Apply Changes
                  </button>
                  <button
                    onClick={() => handleReject(selectedTask.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.10] text-zinc-300 text-sm rounded-lg transition-colors"
                  >
                    <X size={14} />
                    Reject
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Virtualized log viewer — renders only visible rows for 1000+ log entries
function VirtualizedLogs({ logs, logEndRef }: { logs: TaskStreamEvent[]; logEndRef: React.RefObject<HTMLDivElement> }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 22,
    overscan: 20,
  })

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logs.length > 0) {
      virtualizer.scrollToIndex(logs.length - 1, { align: 'end' })
    }
  }, [logs.length, virtualizer])

  if (logs.length === 0) {
    return (
      <div className="flex-1 overflow-auto p-3 font-mono text-xs">
        <p className="text-zinc-600">Waiting for output...</p>
      </div>
    )
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-auto p-3 font-mono text-xs">
      <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const log = logs[virtualRow.index]
          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className={
                log.type === 'tool_use' ? 'text-amber-400' :
                log.type === 'error' ? 'text-red-400' :
                log.type === 'result' ? 'text-emerald-400' :
                'text-zinc-300'
              }
            >
              {log.type === 'tool_use' && <span className="text-zinc-600">&gt; </span>}
              {log.content}
            </div>
          )
        })}
      </div>
      <div ref={logEndRef} />
    </div>
  )
}
