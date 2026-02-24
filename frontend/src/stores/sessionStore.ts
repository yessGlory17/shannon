import { create } from 'zustand'
import type { Session, Task, TaskStreamEvent, DiffResult, ChatMessage, ChatMode } from '../types'

interface SessionState {
  sessions: Session[]
  currentSession: Session | null
  tasks: Task[]
  loading: boolean

  // Stream logs & diffs (persisted across navigation)
  logs: Record<string, TaskStreamEvent[]>
  diffs: Record<string, DiffResult>

  // Chat messages per task (user messages + converted stream events)
  chatMessages: Record<string, ChatMessage[]>

  fetchSessions: () => Promise<void>
  fetchTasks: (sessionID: string) => Promise<void>
  createSession: (s: Partial<Session>) => Promise<Session>
  setCurrentSession: (s: Session | null) => void
  createTask: (t: Partial<Task>) => Promise<Task>
  updateTask: (t: Task) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  startSession: (sessionID: string) => Promise<void>
  stopSession: (sessionID: string) => Promise<void>
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

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSession: null,
  tasks: [],
  loading: false,
  logs: {},
  diffs: {},
  chatMessages: {},

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

  fetchTasks: async (sessionID: string) => {
    try {
      const tasks = await window.go.main.App.ListTasks(sessionID)
      set({ tasks: tasks || [] })
    } catch (e) {
      console.error('Failed to fetch tasks:', e)
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

  refreshTask: async (taskID) => {
    try {
      const task = await window.go.main.App.GetTask(taskID)
      set((state) => ({ tasks: state.tasks.map((x) => (x.id === task.id ? task : x)) }))
    } catch (e) {
      console.error('Failed to refresh task:', e)
    }
  },

  appendLog: (taskID, event) => {
    set((state) => ({
      logs: {
        ...state.logs,
        [taskID]: [...(state.logs[taskID] || []), event],
      },
    }))
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
        set((state) => {
          const merged = { ...state.logs }
          for (const [taskID, events] of Object.entries(allEvents)) {
            if (!merged[taskID] || merged[taskID].length === 0) {
              merged[taskID] = events
            }
          }
          return { logs: merged }
        })
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

    // Add user message to chat
    const userMsg: ChatMessage = {
      id: `user-${++msgCounter}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
      attachments,
    }
    get().addChatMessage(taskID, userMsg)

    // Send to backend
    try {
      await window.go.main.App.SendFollowUp(taskID, fullMessage, mode)
    } catch (e) {
      console.error('Failed to send follow-up:', e)
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
