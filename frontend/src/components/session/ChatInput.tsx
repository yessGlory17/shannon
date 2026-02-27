import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Paperclip, Slash, ChevronDown, X, FileText } from 'lucide-react'
import type { ChatMode } from '../../types'

const modeLabels: Record<ChatMode, { label: string; color: string; desc: string }> = {
  code: { label: 'Code', color: 'text-emerald-400', desc: 'Normal execution' },
  plan: { label: 'Plan', color: 'text-blue-400', desc: 'Describe before changing' },
  auto: { label: 'Auto', color: 'text-amber-400', desc: 'Skip permissions' },
}

interface ChatInputProps {
  onSend: (message: string, mode: ChatMode, attachments: string[]) => void
  disabled?: boolean
  disabledReason?: string
  taskId: string
  onListFiles?: () => Promise<string[]>
  onSlashCommand?: (command: string) => void
  placeholder?: string
}

export function ChatInput({ onSend, disabled, disabledReason, taskId, onListFiles, onSlashCommand, placeholder }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<ChatMode>('code')
  const [showModeMenu, setShowModeMenu] = useState(false)
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [attachments, setAttachments] = useState<string[]>([])
  const [showFilePicker, setShowFilePicker] = useState(false)
  const [fileList, setFileList] = useState<string[]>([])
  const [fileFilter, setFileFilter] = useState('')
  const [pickerIndex, setPickerIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const filePickerRef = useRef<HTMLDivElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, 300) + 'px'
    }
  }, [message])

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filePickerRef.current && !filePickerRef.current.contains(e.target as Node)) {
        setShowFilePicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSend = useCallback(() => {
    const trimmed = message.trim()
    if (!trimmed || disabled) return
    onSend(trimmed, mode, attachments)
    setMessage('')
    setAttachments([])
  }, [message, mode, attachments, disabled, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // File picker keyboard navigation
    if (showFilePicker) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setPickerIndex(prev => Math.min(prev + 1, filteredFiles.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setPickerIndex(prev => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredFiles[pickerIndex]) selectFile(filteredFiles[pickerIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowFilePicker(false)
        return
      }
    }

    // Ctrl/Cmd+Enter: send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
      return
    }
    // Enter: send (Shift+Enter: newline)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
      return
    }
    // Escape: clear and blur
    if (e.key === 'Escape') {
      setMessage('')
      textareaRef.current?.blur()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setMessage(val)

    // Detect @ for file mentions
    if (val.endsWith('@')) {
      openFilePicker()
    }

    // Detect / for slash commands
    if (val === '/') {
      setShowSlashMenu(true)
    } else {
      setShowSlashMenu(false)
    }
  }

  const openFilePicker = async () => {
    if (onListFiles) {
      try {
        const files = await onListFiles()
        setFileList(files || [])
        setFileFilter('')
        setPickerIndex(0)
        setShowFilePicker(true)
      } catch (e) {
        console.error('Failed to list files:', e)
      }
    }
  }

  const selectFile = (filePath: string) => {
    if (!attachments.includes(filePath)) {
      setAttachments((prev) => [...prev, filePath])
    }
    // Remove trailing @
    setMessage((prev) => prev.replace(/@$/, ''))
    setShowFilePicker(false)
  }

  const removeAttachment = (filePath: string) => {
    setAttachments((prev) => prev.filter((f) => f !== filePath))
  }

  const slashCommands = [
    { cmd: '/clear', desc: 'Clear chat display' },
    { cmd: '/model', desc: 'Change model' },
    { cmd: '/plan', desc: 'Switch to Plan mode' },
  ]

  const handleSlashCommand = (cmd: string) => {
    setMessage('')
    setShowSlashMenu(false)
    if (cmd === '/plan') {
      setMode('plan')
    }
    onSlashCommand?.(cmd)
  }

  const filteredFiles = fileFilter
    ? fileList.filter((f) => f.toLowerCase().includes(fileFilter.toLowerCase()))
    : fileList.slice(0, 50)

  return (
    <div className="border-t border-white/[0.06] bg-[#111114]/80">
      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
          {attachments.map((file) => (
            <span
              key={file}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/[0.06] border border-white/[0.08] rounded text-[10px] text-zinc-400"
            >
              <FileText size={10} />
              <span className="max-w-[150px] truncate">{file}</span>
              <button onClick={() => removeAttachment(file)} className="hover:text-zinc-200">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Slash command menu */}
      {showSlashMenu && (
        <div className="mx-3 mt-2 bg-[#111114] border border-white/[0.08] rounded-xl overflow-hidden">
          {slashCommands.map((sc) => (
            <button
              key={sc.cmd}
              onClick={() => handleSlashCommand(sc.cmd)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/[0.06] text-left transition-colors"
            >
              <span className="text-xs font-mono text-zinc-200">{sc.cmd}</span>
              <span className="text-xs text-zinc-500">{sc.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* File picker */}
      {showFilePicker && (
        <div ref={filePickerRef} className="mx-3 mt-2 bg-[#111114] border border-white/[0.08] rounded-xl max-h-48 overflow-hidden flex flex-col">
          <input
            value={fileFilter}
            onChange={(e) => { setFileFilter(e.target.value); setPickerIndex(0) }}
            placeholder="Search files..."
            className="px-3 py-1.5 bg-transparent border-b border-white/[0.06] text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
            autoFocus
          />
          <div className="overflow-auto">
            {filteredFiles.map((file, idx) => (
              <button
                key={file}
                onClick={() => selectFile(file)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                  idx === pickerIndex ? 'bg-white/[0.08]' : 'hover:bg-white/[0.06]'
                }`}
              >
                <FileText size={12} className="text-zinc-500 flex-shrink-0" />
                <span className="text-xs text-zinc-300 truncate">{file}</span>
              </button>
            ))}
            {filteredFiles.length === 0 && (
              <p className="px-3 py-2 text-xs text-zinc-600">No files found</p>
            )}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? disabledReason || 'Waiting...' : placeholder || 'Type a message... (@ for files, / for commands)'}
            disabled={disabled}
            rows={1}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 input-focus resize-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            className="p-2 bg-brand-gradient hover:opacity-90 text-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-brand-sm flex-shrink-0"
          >
            <Send size={16} />
          </button>
        </div>

        {/* Bottom bar: mode + actions */}
        <div className="flex items-center gap-2 mt-1.5">
          {/* Mode selector */}
          <div className="relative">
            <button
              onClick={() => setShowModeMenu(!showModeMenu)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] hover:bg-white/[0.06] transition-colors"
            >
              <span className={modeLabels[mode].color}>{modeLabels[mode].label}</span>
              <ChevronDown size={10} className="text-zinc-500" />
            </button>
            {showModeMenu && (
              <div className="absolute bottom-full left-0 mb-1 bg-[#111114] border border-white/[0.08] rounded-xl overflow-hidden shadow-lg z-10 min-w-[140px]">
                {(Object.keys(modeLabels) as ChatMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setShowModeMenu(false) }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.06] text-left transition-colors ${
                      mode === m ? 'bg-white/[0.04]' : ''
                    }`}
                  >
                    <span className={`text-xs font-medium ${modeLabels[m].color}`}>{modeLabels[m].label}</span>
                    <span className="text-[10px] text-zinc-500">{modeLabels[m].desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* File attach button */}
          <button
            onClick={openFilePicker}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
            title="Attach file (@)"
          >
            <Paperclip size={11} />
            <span>@</span>
          </button>

          {/* Slash command button */}
          <button
            onClick={() => { setMessage('/'); setShowSlashMenu(true); textareaRef.current?.focus() }}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
            title="Commands (/)"
          >
            <Slash size={11} />
          </button>
        </div>
      </div>
    </div>
  )
}
