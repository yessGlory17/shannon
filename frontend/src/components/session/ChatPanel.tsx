import { memo, useEffect, useRef, useState, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Bot, User, Users, Terminal, AlertTriangle,
  TestTube, CheckCircle, XCircle, Loader2,
  ArrowDown, MessageCircleQuestion,
  RotateCcw, Play,
} from 'lucide-react'
import { ChatInput } from './ChatInput'
import { MarkdownRenderer } from '../chat/MarkdownRenderer'
import { ToolOutput } from '../chat/ToolOutput'
import { QuickReplies } from '../chat/QuickReplies'
import { useSessionStore, useTaskLogs, useTaskChat } from '../../stores/sessionStore'
import type { Task, Agent, Team, TaskStreamEvent, ChatMode, ChatMessage } from '../../types'

type InterleavedItem =
  | { kind: 'log'; key: string; event: TaskStreamEvent }
  | { kind: 'chat'; key: string; message: ChatMessage }

interface ChatPanelProps {
  task: Task | null
  agents: Agent[]
  teams: Team[]
  sessionId: string
}

export function ChatPanel({ task, agents, teams, sessionId }: ChatPanelProps) {
  // Granular selectors — only re-render when THIS task's data changes
  const taskLogs = useTaskLogs(task?.id)
  const taskChat = useTaskChat(task?.id)
  const sendFollowUp = useSessionStore((s) => s.sendFollowUp)
  const clearChatMessages = useSessionStore((s) => s.clearChatMessages)
  const followUpInFlight = useSessionStore((s) => s._followUpInFlight)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [newMsgCount, setNewMsgCount] = useState(0)
  const isNearBottomRef = useRef(true)
  const [retrying, setRetrying] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [showResumeInput, setShowResumeInput] = useState(false)
  const [resumePrompt, setResumePrompt] = useState('')

  const agentName = task?.team_id
    ? (teams.find((t) => t.id === task.team_id)?.name || task.team_id.slice(0, 8))
    : task?.agent_id
      ? (agents.find((a) => a.id === task.agent_id)?.name || task.agent_id.slice(0, 8))
      : 'Unassigned'

  // Track scroll position — throttled to avoid excessive setState calls
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    let ticking = false
    const handleScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
        isNearBottomRef.current = distanceFromBottom < 80
        setShowScrollBtn(distanceFromBottom > 100)
        if (isNearBottomRef.current) setNewMsgCount(0)
        ticking = false
      })
    }
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Smart auto-scroll: debounced to avoid thrashing during rapid streaming
  useEffect(() => {
    if (isNearBottomRef.current) {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
      }, 100)
      return () => clearTimeout(timer)
    } else {
      setNewMsgCount(prev => prev + 1)
    }
  }, [taskLogs.length, taskChat.length])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
    setNewMsgCount(0)
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

  const handleRetry = async () => {
    if (!task) return
    setRetrying(true)
    try {
      await window.go.main.App.RetryTask(task.id)
    } catch (e) {
      console.error('Retry failed:', e)
    } finally {
      setRetrying(false)
    }
  }

  const handleResume = async () => {
    if (!task) return
    setResuming(true)
    try {
      await window.go.main.App.ResumeTask(task.id, resumePrompt)
      setShowResumeInput(false)
      setResumePrompt('')
    } catch (e) {
      console.error('Resume failed:', e)
    } finally {
      setResuming(false)
    }
  }

  // Data-only interleaving — produces lightweight item descriptors instead of JSX elements.
  // The virtualizer below renders only the visible subset.
  const interleavedItems = useMemo(() => {
    const items: InterleavedItem[] = []
    let chatIdx = 0

    for (let i = 0; i <= taskLogs.length; i++) {
      while (chatIdx < taskChat.length && (taskChat[chatIdx].logIndex ?? Infinity) === i) {
        items.push({ kind: 'chat', key: taskChat[chatIdx].id, message: taskChat[chatIdx] })
        chatIdx++
      }
      if (i < taskLogs.length) {
        items.push({ kind: 'log', key: `log-${i}`, event: taskLogs[i] })
      }
    }

    while (chatIdx < taskChat.length) {
      items.push({ kind: 'chat', key: taskChat[chatIdx].id, message: taskChat[chatIdx] })
      chatIdx++
    }

    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskLogs.length, taskChat.length])

  // Virtualize the message list — only render visible items + overscan
  const virtualizer = useVirtualizer({
    count: interleavedItems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 36,
    overscan: 20,
  })

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
  const isFollowUpRunning = followUpInFlight.has(task.id)
  const isAwaitingInput = task.status === 'awaiting_input'
  const canChat = !!task.claude_session_id && (
    task.status === 'completed' ||
    task.status === 'failed' ||
    task.status === 'awaiting_input' ||
    isFollowUpRunning // keep chat input enabled while our follow-up is processing
  )
  const disabledReason = !task.claude_session_id
    ? 'Task has not been executed yet'
    : (isRunning && !isFollowUpRunning)
    ? 'Task is running...'
    : task.status === 'pending'
    ? 'Task has not started yet'
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
              {task.retry_count > 0 && (
                <span className="text-[10px] text-amber-400/70 bg-amber-900/20 px-1.5 py-0.5 rounded">
                  retry {task.retry_count}/{task.max_retries}
                </span>
              )}
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

      {/* Messages — virtualized interleaved stream events and chat messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto p-3 relative min-h-0">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = interleavedItems[virtualRow.index]
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="pb-2">
                  {item.kind === 'log'
                    ? <StreamEventMessage event={item.event} />
                    : <ChatMessageBubble message={item.message} />
                  }
                </div>
              </div>
            )
          })}
        </div>

        {/* Error + Retry/Resume */}
        {task.status === 'failed' && (
          <div className="space-y-2">
            {task.error && (
              <div className="flex gap-2 px-3 py-2 bg-red-950/30 border border-red-900/50 rounded-lg">
                <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                <pre className="text-xs text-red-300/80 font-mono whitespace-pre-wrap break-all">{task.error}</pre>
              </div>
            )}
            {/* Retry/Resume badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {task.retry_count > 0 && (
                <span className="text-[10px] text-amber-400/80 bg-amber-900/20 border border-amber-500/20 px-1.5 py-0.5 rounded">
                  Retried {task.retry_count}/{task.max_retries}
                </span>
              )}
              {task.resume_count > 0 && (
                <span className="text-[10px] text-blue-400/80 bg-blue-900/20 border border-blue-500/20 px-1.5 py-0.5 rounded">
                  Resumed {task.resume_count}x
                </span>
              )}
            </div>
            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-medium rounded-lg disabled:opacity-50 transition-colors border border-amber-500/20"
              >
                {retrying ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                Retry
              </button>
              {task.claude_session_id ? (
                <button
                  onClick={() => setShowResumeInput(!showResumeInput)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs font-medium rounded-lg transition-colors border border-blue-500/20"
                >
                  <Play size={10} />
                  Resume
                </button>
              ) : (
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs font-medium rounded-lg disabled:opacity-50 transition-colors border border-blue-500/20"
                >
                  <Play size={10} />
                  Restart
                </button>
              )}
            </div>
            {/* Resume prompt input */}
            {showResumeInput && (
              <div className="flex gap-2">
                <input
                  value={resumePrompt}
                  onChange={(e) => setResumePrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleResume() }}
                  placeholder="Additional instructions for resume (optional)..."
                  className="flex-1 px-3 py-1.5 bg-white/[0.04] border border-blue-500/20 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-600 input-focus transition-colors"
                />
                <button
                  onClick={handleResume}
                  disabled={resuming}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
                >
                  {resuming ? <Loader2 size={10} className="animate-spin" /> : 'Go'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Awaiting input banner */}
        {isAwaitingInput && (
          <div className="space-y-2">
            {/* Agent's question text */}
            {task.pending_input_data && (
              <div className="px-3 py-2 bg-purple-950/20 border border-purple-500/30 rounded-lg">
                <MarkdownRenderer content={task.pending_input_data} />
              </div>
            )}
            {/* Quick reply buttons */}
            <QuickReplies
              pendingData={task.pending_input_data || ''}
              onReply={(text) => handleSend(text, 'code', [])}
            />
            {/* Banner */}
            <div className="flex items-center gap-2 px-3 py-1.5 text-purple-400/70">
              <MessageCircleQuestion size={12} />
              <span className="text-[11px]">Type your reply or select an option above</span>
            </div>
          </div>
        )}

        {/* Running indicator - typing dots */}
        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-zinc-500 py-1.5 px-1">
            <Bot size={14} className="text-zinc-600" />
            <span className="text-zinc-500 text-xs tracking-widest">...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom */}
      {showScrollBtn && (
        <div className="absolute bottom-20 right-6">
          <button
            onClick={scrollToBottom}
            className="relative p-1.5 bg-white/[0.10] hover:bg-white/[0.14] rounded-full shadow-lg transition-colors"
          >
            <ArrowDown size={14} className="text-zinc-300" />
            {newMsgCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-[9px] text-white flex items-center justify-center font-medium">
                {newMsgCount > 9 ? '9+' : newMsgCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Input */}
      <div className={isAwaitingInput ? 'ring-1 ring-purple-500/60 rounded-lg' : ''}>
        <ChatInput
          onSend={handleSend}
          disabled={!canChat}
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

const StreamEventMessage = memo(function StreamEventMessage({ event }: { event: TaskStreamEvent }) {
  if (event.type === 'init') {
    return (
      <div className="text-xs text-zinc-600 py-0.5 flex items-center gap-1">
        <Terminal size={10} />
        {event.content}
      </div>
    )
  }

  if (event.type === 'tool_use') {
    return <ToolOutput content={event.content} />
  }

  if (event.type === 'result') {
    return (
      <div className="flex gap-2 py-1">
        <CheckCircle size={12} className="text-emerald-400 flex-shrink-0 mt-0.5" />
        <MarkdownRenderer content={event.content} className="text-emerald-300/80" />
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
      <div className="min-w-0 flex-1">
        <MarkdownRenderer content={event.content} />
      </div>
    </div>
  )
})

const ChatMessageBubble = memo(function ChatMessageBubble({ message }: { message: { role: string; content: string; type?: string; attachments?: string[] } }) {
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
      <div className="min-w-0 flex-1">
        <MarkdownRenderer content={message.content} />
      </div>
    </div>
  )
})
