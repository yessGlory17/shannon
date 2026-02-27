import { create } from 'zustand'
import type { Session, Task, TaskStreamEvent, DiffResult, ChatMessage, ChatMode, PaginatedResponse } from '../types'

interface SessionState {
  sessions: Session[]
  currentSession: Session | null
  tasks: Task[]
  loading: boolean

  // Diffs (fetched on demand, small footprint)
  diffs: Record<string, DiffResult>

  // Chat messages per task (user messages + system errors — small, kept in Zustand)
  chatMessages: Record<string, ChatMessage[]>

  // Event count tracking — only counts live in Zustand for reactivity.
  // Actual event data lives in _eventStore (module-level Map, no reactivity overhead).
  _logCounts: Record<string, number>

  // Sync tracking — prevents polling from overwriting fresh event-driven updates
  _taskVersions: Record<string, number>
  _fetchInFlight: boolean
  _followUpInFlight: Set<string>  // taskIDs with active follow-ups (keeps chat input enabled)

  pagination: { page: number; totalPages: number; totalItems: number; pageSize: number }
  fetchSessions: () => Promise<void>
  fetchSessionsPaginated: (page: number, pageSize?: number) => Promise<void>
  fetchTasks: (sessionID: string) => Promise<void>
  createSession: (s: Partial<Session>) => Promise<Session>
  setCurrentSession: (s: Session | null) => void
  createTask: (t: Partial<Task>) => Promise<Task>
  updateTask: (t: Task) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  startSession: (sessionID: string) => Promise<void>
  stopSession: (sessionID: string) => Promise<void>
  completeSession: (sessionID: string) => Promise<void>
  refreshTask: (taskID: string) => Promise<void>

  // Stream event actions
  appendLog: (taskID: string, event: TaskStreamEvent) => void
  setDiff: (taskID: string, diff: DiffResult) => void
  loadSessionEvents: (sessionID: string) => Promise<void>

  // Chat actions
  addChatMessage: (taskID: string, message: ChatMessage) => void
  sendFollowUp: (taskID: string, message: string, mode: ChatMode, attachments?: string[]) => Promise<void>
  clearChatMessages: (taskID: string) => void

  // Hunk operations
  acceptHunk: (taskID: string, filePath: string, hunkIndex: number) => Promise<void>
  rejectHunk: (taskID: string, filePath: string, hunkIndex: number, reason: string) => Promise<void>
  acceptFile: (taskID: string, filePath: string) => Promise<void>
  rejectFile: (taskID: string, filePath: string, reason: string) => Promise<void>
  saveWorkspaceFile: (taskID: string, filePath: string, content: string) => Promise<void>
  refreshDiff: (taskID: string) => Promise<void>
}

let msgCounter = 0

// ─── External event store ────────────────────────────────────────────
// Event data lives here — a plain Map with zero reactivity overhead.
// Zustand only stores counts (_logCounts) to trigger re-renders.
// This avoids copying large arrays through Zustand's set() / equality checks.
const _eventStore = new Map<string, TaskStreamEvent[]>()

// ─── Log batching ────────────────────────────────────────────────────
// Accumulates stream events and flushes counts to Zustand once per animation frame.
const _logBatch = {
  dirty: new Set<string>(),
  scheduled: false,
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSession: null,
  tasks: [],
  loading: false,
  diffs: {},
  chatMessages: {},
  _logCounts: {},
  _taskVersions: {},
  _fetchInFlight: false,
  _followUpInFlight: new Set(),
  pagination: { page: 1, totalPages: 1, totalItems: 0, pageSize: 10 },

  fetchSessions: async () => {
    set({ loading: true })
    try {
      const sessions = await window.go.main.App.ListSessions()
      set({ sessions: sessions || [] })
    } catch (e) {
      console.error('Failed to fetch sessions:', e)
    } finally {
      set({ loading: false })
    }
  },

  fetchSessionsPaginated: async (page: number, pageSize = 10) => {
    set({ loading: true })
    try {
      const res = await window.go.main.App.ListSessionsPaginated(page, pageSize) as unknown as PaginatedResponse<Session>
      set({
        sessions: res.items || [],
        pagination: {
          page: res.page,
          totalPages: res.total_pages,
          totalItems: res.total_count,
          pageSize: res.page_size,
        },
      })
    } catch (e) {
      console.error('Failed to fetch sessions:', e)
    } finally {
      set({ loading: false })
    }
  },

  fetchTasks: async (sessionID: string) => {
    // Prevent concurrent fetches (deduplication)
    if (get()._fetchInFlight) return
    set({ _fetchInFlight: true })
    try {
      const tasks = await window.go.main.App.ListTasks(sessionID)
      const now = Date.now()
      set((state) => {
        // For each task, keep the existing (event-driven) version if it was
        // updated within the last 5 seconds — prevents polling from reverting
        // fresh status changes with stale DB reads.
        const merged = (tasks || []).map((polledTask) => {
          const ver = state._taskVersions[polledTask.id] || 0
          if (ver > now - 5000) {
            const existing = state.tasks.find((t) => t.id === polledTask.id)
            return existing || polledTask
          }
          return polledTask
        })
        return { tasks: merged }
      })
    } catch (e) {
      console.error('Failed to fetch tasks:', e)
    } finally {
      set({ _fetchInFlight: false })
    }
  },

  createSession: async (s) => {
    const created = await window.go.main.App.CreateSession(s as Session)
    set((state) => ({ sessions: [created, ...state.sessions] }))
    return created
  },

  setCurrentSession: (s) => set({ currentSession: s }),

  createTask: async (t) => {
    const created = await window.go.main.App.CreateTask(t as Task)
    set((state) => ({ tasks: [...state.tasks, created] }))
    return created
  },

  updateTask: async (t) => {
    await window.go.main.App.UpdateTask(t)
    set((state) => ({ tasks: state.tasks.map((x) => (x.id === t.id ? t : x)) }))
  },

  deleteTask: async (id) => {
    await window.go.main.App.DeleteTask(id)
    set((state) => ({ tasks: state.tasks.filter((x) => x.id !== id) }))
  },

  startSession: async (sessionID) => {
    await window.go.main.App.StartSession(sessionID)
  },

  stopSession: async (sessionID) => {
    await window.go.main.App.StopSession(sessionID)
  },

  completeSession: async (sessionID) => {
    await window.go.main.App.CompleteSession(sessionID)
  },

  refreshTask: async (taskID) => {
    try {
      const task = await window.go.main.App.GetTask(taskID)
      const now = Date.now()
      set((state) => {
        // Clear follow-up in-flight flag when task leaves running/queued state
        let followUpSet = state._followUpInFlight
        if (task.status !== 'running' && task.status !== 'queued' && followUpSet.has(taskID)) {
          followUpSet = new Set(followUpSet)
          followUpSet.delete(taskID)
        }
        return {
          tasks: state.tasks.map((x) => (x.id === task.id ? task : x)),
          _taskVersions: { ...state._taskVersions, [taskID]: now },
          _followUpInFlight: followUpSet,
        }
      })
    } catch (e) {
      console.error('Failed to refresh task:', e)
    }
  },

  appendLog: (taskID, event) => {
    // Push to external store immediately (no Zustand overhead)
    let arr = _eventStore.get(taskID)
    if (!arr) {
      arr = []
      _eventStore.set(taskID, arr)
    }
    arr.push(event)

    // Schedule a batched count update in Zustand (once per frame)
    _logBatch.dirty.add(taskID)
    if (!_logBatch.scheduled) {
      _logBatch.scheduled = true
      requestAnimationFrame(() => {
        _logBatch.scheduled = false
        const taskIDs = _logBatch.dirty
        _logBatch.dirty = new Set()

        // Prune oversized arrays
        for (const tid of taskIDs) {
          const events = _eventStore.get(tid)
          if (events && events.length > 500) {
            _eventStore.set(tid, events.slice(-400))
          }
        }

        // Only update counts in Zustand — the actual data stays in _eventStore
        set((state) => {
          const counts = { ...state._logCounts }
          for (const tid of taskIDs) {
            counts[tid] = _eventStore.get(tid)?.length ?? 0
          }
          return { _logCounts: counts }
        })
      })
    }
  },

  setDiff: (taskID, diff) => {
    set((state) => ({
      diffs: { ...state.diffs, [taskID]: diff },
    }))
  },

  loadSessionEvents: async (sessionID) => {
    try {
      const allEvents = await window.go.main.App.GetSessionStreamEvents(sessionID)
      if (allEvents) {
        const counts: Record<string, number> = {}
        for (const [taskID, events] of Object.entries(allEvents)) {
          // Only populate if we don't already have data (from real-time events)
          const existing = _eventStore.get(taskID)
          if (!existing || existing.length === 0) {
            _eventStore.set(taskID, events)
          }
          counts[taskID] = _eventStore.get(taskID)?.length ?? 0
        }
        set((state) => ({
          _logCounts: { ...state._logCounts, ...counts },
        }))
      }
    } catch (e) {
      console.error('Failed to load session events:', e)
    }
  },

  addChatMessage: (taskID, message) => {
    set((state) => ({
      chatMessages: {
        ...state.chatMessages,
        [taskID]: [...(state.chatMessages[taskID] || []), message],
      },
    }))
  },

  sendFollowUp: async (taskID, message, mode, attachments) => {
    // Build full message with file attachments
    let fullMessage = message
    if (attachments && attachments.length > 0) {
      const fileContents: string[] = []
      for (const filePath of attachments) {
        try {
          const content = await window.go.main.App.ReadProjectFile(taskID, filePath)
          fileContents.push(`<file path="${filePath}">\n${content}\n</file>`)
        } catch (e) {
          console.error(`Failed to read file ${filePath}:`, e)
        }
      }
      if (fileContents.length > 0) {
        fullMessage = fileContents.join('\n\n') + '\n\n' + message
      }
    }

    // Add user message to chat with current log count for interleaving
    const currentLogCount = _eventStore.get(taskID)?.length ?? 0
    const userMsg: ChatMessage = {
      id: `user-${++msgCounter}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
      attachments,
      logIndex: currentLogCount,
    }
    get().addChatMessage(taskID, userMsg)

    // Mark follow-up as in-flight (keeps chat input enabled while running)
    set((state) => {
      const next = new Set(state._followUpInFlight)
      next.add(taskID)
      return { _followUpInFlight: next }
    })

    // Send to backend
    try {
      await window.go.main.App.SendFollowUp(taskID, fullMessage, mode)
    } catch (e) {
      console.error('Failed to send follow-up:', e)
      // Clear in-flight on error
      set((state) => {
        const next = new Set(state._followUpInFlight)
        next.delete(taskID)
        return { _followUpInFlight: next }
      })
      // Add error message
      get().addChatMessage(taskID, {
        id: `err-${++msgCounter}`,
        role: 'system',
        content: `Failed to send: ${e}`,
        type: 'error',
        timestamp: Date.now(),
      })
    }
  },

  clearChatMessages: (taskID) => {
    set((state) => ({
      chatMessages: {
        ...state.chatMessages,
        [taskID]: [],
      },
    }))
  },

  acceptHunk: async (taskID, filePath, hunkIndex) => {
    await window.go.main.App.AcceptHunk(taskID, filePath, hunkIndex)
    get().refreshDiff(taskID)
  },

  rejectHunk: async (taskID, filePath, hunkIndex, reason) => {
    await window.go.main.App.RejectHunk(taskID, filePath, hunkIndex, reason)
    get().refreshDiff(taskID)
  },

  acceptFile: async (taskID, filePath) => {
    await window.go.main.App.AcceptFile(taskID, filePath)
    get().refreshDiff(taskID)
  },

  rejectFile: async (taskID, filePath, reason) => {
    await window.go.main.App.RejectFile(taskID, filePath, reason)
    get().refreshDiff(taskID)
  },

  saveWorkspaceFile: async (taskID, filePath, content) => {
    await window.go.main.App.SaveWorkspaceFile(taskID, filePath, content)
    get().refreshDiff(taskID)
  },

  refreshDiff: async (taskID) => {
    try {
      const diff = await window.go.main.App.GetTaskDiff(taskID)
      set((state) => ({ diffs: { ...state.diffs, [taskID]: diff } }))
    } catch (e) {
      console.error('Failed to refresh diff:', e)
    }
  },
}))

// ─── Granular selector hooks (prevent unnecessary re-renders) ─────────
const emptyLogs: TaskStreamEvent[] = []
const emptyChat: ChatMessage[] = []

/**
 * Returns stream events for a task from the external store.
 * Subscribes to the Zustand count for reactivity — when new events arrive,
 * the count changes, triggering a re-render, and this hook returns the
 * updated array from the external store.
 */
export function useTaskLogs(taskId: string | undefined): TaskStreamEvent[] {
  // Subscribe to count — this is the reactivity trigger
  useSessionStore((s) => (taskId ? s._logCounts[taskId] ?? 0 : 0))
  // Read actual data from external store (zero-cost, no Zustand overhead)
  return taskId ? _eventStore.get(taskId) ?? emptyLogs : emptyLogs
}

export const useTaskChat = (taskId: string | undefined) =>
  useSessionStore((s) => (taskId ? s.chatMessages[taskId] ?? emptyChat : emptyChat))

export const useTaskDiff = (taskId: string | undefined) =>
  useSessionStore((s) => (taskId ? s.diffs[taskId] ?? null : null))
