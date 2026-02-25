import { useEffect, useRef, useState } from 'react'
import {
  Bot, User, Users, Terminal, AlertTriangle,
  TestTube, CheckCircle, XCircle, Loader2,
  ChevronDown, ArrowDown, MessageCircleQuestion,
} from 'lucide-react'
import { ChatInput } from './ChatInput'
import { useSessionStore } from '../../stores/sessionStore'
import type { Task, Agent, Team, TaskStreamEvent, ChatMode } from '../../types'

interface ChatPanelProps {
  task: Task | null
  agents: Agent[]
  teams: Team[]
  sessionId: string
}

export function ChatPanel({ task, agents, teams, sessionId }: ChatPanelProps) {
  const { logs, chatMessages, sendFollowUp, clearChatMessages } = useSessionStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set())

  const taskLogs = task ? (logs[task.id] || []) : []
  const taskChat = task ? (chatMessages[task.id] || []) : []

  const agentName = task?.team_id
    ? (teams.find((t) => t.id === task.team_id)?.name || task.team_id.slice(0, 8))
    : task?.agent_id
      ? (agents.find((a) => a.id === task.agent_id)?.name || task.agent_id.slice(0, 8))
      : 'Unassigned'

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [taskLogs.length, taskChat.length])

  // Show/hide scroll-to-bottom button
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const handler = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100)
    }
    container.addEventListener('scroll', handler)
    return () => container.removeEventListener('scroll', handler)
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSend = async (message: string, mode: ChatMode, attachments: string[]) => {
    if (!task) return
    await sendFollowUp(task.id, message, mode, attachments)
  }

  const handleListFiles = async (): Promise<string[]> => {
    if (!task) return []
    try {
      return await window.go.main.App.ListProjectFiles(task.id)
    } catch {
      return []
    }
  }

  const handleSlashCommand = (cmd: string) => {
    if (!task) return
    if (cmd === '/clear') {
      clearChatMessages(task.id)
    }
  }

  const toggleToolExpand = (index: number) => {
    setExpandedTools((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  if (!task) {
    return (
      <div className="flex-1 flex flex-col rounded-xl bg-[#111114] border border-white/[0.06]">
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
          Select a task node to view its chat
        </div>
      </div>
    )
  }

  const isRunning = task.status === 'running' || task.status === 'queued'
  const isAwaitingInput = task.status === 'awaiting_input'
  const canChat = !!task.claude_session_id && !isRunning
  const disabledReason = !task.claude_session_id
    ? 'Task has not been executed yet'
    : isRunning
    ? 'Task is running...'
    : undefined

  return (
    <div className="flex-1 flex flex-col rounded-xl bg-[#111114] border border-white/[0.06] min-h-0">
      {/* Task header */}
      <div className="px-4 py-2.5 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-zinc-200 truncate">{task.title}</h3>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="flex items-center gap-1 text-xs text-zinc-500">
                {task?.team_id ? <Users size={10} /> : <Bot size={10} />}
                {agentName}
              </span>
              <StatusBadge status={task.status} />
            </div>
          </div>
        </div>

        {/* Test results */}
        {task.test_passed !== undefined && (
          <div className="mt-1 flex items-center gap-1.5">
            <TestTube size={12} className="text-zinc-500" />
            {task.test_passed ? (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle size={10} /> Tests passed
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-red-400">
                <XCircle size={10} /> Tests failed
              </span>
            )}
          </div>
        )}
      </div>

      {/* Messages - interleaved stream events and chat messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto p-3 space-y-2 relative min-h-0">
        {(() => {
          // Build interleaved view: insert user messages at the correct log positions
          const elements: React.ReactNode[] = []
          let chatIdx = 0

          for (let i = 0; i <= taskLogs.length; i++) {
            // Insert any chat messages that were sent at this log index
            while (chatIdx < taskChat.length && (taskChat[chatIdx].logIndex ?? Infinity) === i) {
              elements.push(<ChatMessageBubble key={taskChat[chatIdx].id} message={taskChat[chatIdx]} />)
              chatIdx++
            }
            // Render the stream event
            if (i < taskLogs.length) {
              elements.push(
                <StreamEventMessage key={`log-${i}`} event={taskLogs[i]} index={i} expanded={expandedTools.has(i)} onToggle={() => toggleToolExpand(i)} />
              )
            }
          }

          // Render any remaining chat messages (no logIndex or sent after all logs)
          while (chatIdx < taskChat.length) {
            elements.push(<ChatMessageBubble key={taskChat[chatIdx].id} message={taskChat[chatIdx]} />)
            chatIdx++
          }

          return elements
        })()}

        {/* Error */}
        {task.status === 'failed' && task.error && (
          <div className="flex gap-2 px-3 py-2 bg-red-950/30 border border-red-900/50 rounded-lg">
            <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
            <pre className="text-xs text-red-300/80 font-mono whitespace-pre-wrap break-all">{task.error}</pre>
          </div>
        )}

        {/* Awaiting input banner */}
        {isAwaitingInput && (
          <div className="flex items-start gap-2.5 px-3 py-2.5 bg-purple-950/30 border border-purple-500/40 rounded-lg animate-pulse">
            <MessageCircleQuestion size={16} className="text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-purple-300">Agent is waiting for your response</p>
              <p className="text-[11px] text-purple-400/70 mt-0.5">Type your reply below to continue the conversation</p>
            </div>
          </div>
        )}

        {/* Running indicator */}
        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-blue-400 py-1">
            <Loader2 size={12} className="animate-spin" />
            <span>Processing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom */}
      {showScrollBtn && (
        <div className="absolute bottom-20 right-6">
          <button
            onClick={scrollToBottom}
            className="p-1.5 bg-white/[0.10] hover:bg-white/[0.14] rounded-full shadow-lg transition-colors"
          >
            <ArrowDown size={14} className="text-zinc-300" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className={isAwaitingInput ? 'ring-1 ring-purple-500/60 rounded-lg' : ''}>
        <ChatInput
          onSend={handleSend}
          disabled={!canChat && !isRunning}
          disabledReason={disabledReason}
          taskId={task.id}
          onListFiles={handleListFiles}
          onSlashCommand={handleSlashCommand}
          placeholder={isAwaitingInput ? 'Reply to the agent...' : undefined}
        />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-white/[0.06] text-zinc-400',
    queued: 'bg-amber-900/50 text-amber-400',
    running: 'bg-blue-900/50 text-blue-400',
    completed: 'bg-emerald-900/50 text-emerald-400',
    failed: 'bg-red-900/50 text-red-400',
    cancelled: 'bg-white/[0.06] text-zinc-500',
    awaiting_input: 'bg-purple-900/50 text-purple-400',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] capitalize ${colors[status] || colors.pending}`}>
      {status}
    </span>
  )
}

function StreamEventMessage({
  event,
  index,
  expanded,
  onToggle,
}: {
  event: TaskStreamEvent
  index: number
  expanded: boolean
  onToggle: () => void
}) {
  if (event.type === 'init') {
    return (
      <div className="text-xs text-zinc-600 py-0.5 flex items-center gap-1">
        <Terminal size={10} />
        {event.content}
      </div>
    )
  }

  if (event.type === 'tool_use') {
    return (
      <div className="group">
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 text-xs text-amber-400/80 hover:text-amber-400 transition-colors w-full text-left"
        >
          <ChevronDown size={10} className={`transition-transform ${expanded ? '' : '-rotate-90'}`} />
          <span className="text-zinc-600">&gt;</span>
          <span className="truncate">{event.content}</span>
        </button>
        {expanded && (
          <pre className="ml-5 mt-1 text-[10px] text-zinc-500 font-mono whitespace-pre-wrap break-all bg-white/[0.03] rounded-lg p-2">
            {event.content}
          </pre>
        )}
      </div>
    )
  }

  if (event.type === 'result') {
    return (
      <div className="flex gap-2 py-1">
        <CheckCircle size={12} className="text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-300/80 whitespace-pre-wrap break-words">{event.content}</div>
      </div>
    )
  }

  if (event.type === 'error') {
    return (
      <div className="flex gap-2 py-1">
        <AlertTriangle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-red-300/80 whitespace-pre-wrap break-words">{event.content}</div>
      </div>
    )
  }

  if (event.type === 'done') {
    return null // Don't show done event
  }

  // Default: text content from assistant
  return (
    <div className="flex gap-2 py-0.5">
      <Bot size={12} className="text-zinc-500 flex-shrink-0 mt-0.5" />
      <div className="text-xs text-zinc-300 whitespace-pre-wrap break-words">{event.content}</div>
    </div>
  )
}

function ChatMessageBubble({ message }: { message: { role: string; content: string; type?: string; attachments?: string[] } }) {
  if (message.role === 'user') {
    return (
      <div className="flex gap-2 py-1 justify-end">
        <div className="max-w-[85%]">
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1 justify-end">
              {message.attachments.map((f) => (
                <span key={f} className="text-[10px] text-zinc-500 bg-white/[0.06] px-1.5 py-0.5 rounded">
                  @{f}
                </span>
              ))}
            </div>
          )}
          <div className="bg-brand-gradient-subtle border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-zinc-200 whitespace-pre-wrap">
            {message.content}
          </div>
        </div>
        <User size={12} className="text-zinc-500 flex-shrink-0 mt-1" />
      </div>
    )
  }

  if (message.type === 'error') {
    return (
      <div className="flex gap-2 py-1">
        <AlertTriangle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-red-300/80">{message.content}</div>
      </div>
    )
  }

  return (
    <div className="flex gap-2 py-0.5">
      <Bot size={12} className="text-zinc-500 flex-shrink-0 mt-0.5" />
      <div className="text-xs text-zinc-300 whitespace-pre-wrap">{message.content}</div>
    </div>
  )
}
