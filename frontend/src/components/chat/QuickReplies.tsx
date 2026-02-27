import React, { useState, useMemo } from 'react'

interface QuickRepliesProps {
  pendingData: string
  onReply: (text: string) => void
}

interface Option {
  label: string
  value: string
}

interface QuickAction {
  label: string
  value: string
  style: string
}

function parseOptions(text: string): Option[] {
  const lines = text.split('\n')
  const options: Option[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    // "1. Option text" or "1) Option text"
    const numbered = trimmed.match(/^(\d+)[.)]\s+(.+)/)
    if (numbered) {
      options.push({ label: numbered[2].trim(), value: numbered[1] })
      continue
    }
    // "- Option text" or "* Option text"
    const bulleted = trimmed.match(/^[-*]\s+(.+)/)
    if (bulleted) {
      options.push({ label: bulleted[1].trim(), value: bulleted[1].trim() })
      continue
    }
    // "a) Option text" or "a. Option text"
    const lettered = trimmed.match(/^([a-z])[.)]\s+(.+)/i)
    if (lettered) {
      options.push({ label: lettered[2].trim(), value: lettered[1] })
    }
  }
  return options
}

function detectQuickActions(text: string): QuickAction[] {
  const lastParagraph = text.includes('\n\n')
    ? text.slice(text.lastIndexOf('\n\n')).trim()
    : text.trim()
  const lowerLast = lastParagraph.toLowerCase()

  const actions: QuickAction[] = []
  const hasOptions = parseOptions(text).length > 0

  // Yes/no questions (only if no parsed options)
  if (lowerLast.endsWith('?') && !hasOptions) {
    if (
      lowerLast.includes('proceed') || lowerLast.includes('continue') ||
      lowerLast.includes('devam') || lowerLast.includes('shall i') ||
      lowerLast.includes('should i') || lowerLast.includes('want me to')
    ) {
      actions.push(
        { label: 'Yes, proceed', value: 'Yes, please proceed.', style: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/20' },
        { label: 'No', value: 'No, please stop.', style: 'text-red-300 bg-red-500/10 border-red-500/25 hover:bg-red-500/20' },
      )
      return actions
    }
  }

  // Approval requests
  if (
    lowerLast.includes('approve') || lowerLast.includes('confirm') ||
    lowerLast.includes('onay') || lowerLast.includes('onayla')
  ) {
    actions.push(
      { label: 'Approve', value: 'Approved. Please proceed.', style: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/20' },
      { label: 'Reject', value: 'Rejected. Please try a different approach.', style: 'text-red-300 bg-red-500/10 border-red-500/25 hover:bg-red-500/20' },
    )
    return actions
  }

  // Generic yes/no for other questions
  if (lowerLast.endsWith('?') && !hasOptions) {
    actions.push(
      { label: 'Yes', value: 'Yes.', style: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/20' },
      { label: 'No', value: 'No.', style: 'text-red-300 bg-red-500/10 border-red-500/25 hover:bg-red-500/20' },
    )
  }

  return actions
}

export const QuickReplies = React.memo(function QuickReplies({ pendingData, onReply }: QuickRepliesProps) {
  const [clicked, setClicked] = useState<string | null>(null)
  const options = useMemo(() => parseOptions(pendingData), [pendingData])
  const quickActions = useMemo(() => detectQuickActions(pendingData), [pendingData])

  if (options.length === 0 && quickActions.length === 0) return null

  const handleClick = (value: string) => {
    setClicked(value)
    onReply(value)
  }

  return (
    <div className="flex flex-wrap gap-1.5 px-1">
      {options.map((opt, i) => (
        <button
          key={i}
          onClick={() => handleClick(opt.value)}
          disabled={clicked !== null}
          className="px-2.5 py-1 text-[11px] text-purple-300 bg-purple-500/10
                     border border-purple-500/25 rounded-lg
                     hover:bg-purple-500/20 hover:border-purple-500/40
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {opt.label}
        </button>
      ))}
      {quickActions.map((action, i) => (
        <button
          key={`qa-${i}`}
          onClick={() => handleClick(action.value)}
          disabled={clicked !== null}
          className={`px-2.5 py-1 text-[11px] rounded-lg border
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors ${action.style}`}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
})
