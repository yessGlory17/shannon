import React, { useState, useMemo } from 'react'
import { Terminal, FileText, Pencil, Search, Wrench, ChevronRight } from 'lucide-react'
import { CopyButton } from './CopyButton'
import { CodeBlock } from './CodeBlock'

interface ToolOutputProps {
  content: string
}

const toolIconMap: Record<string, React.ElementType> = {
  Bash: Terminal,
  bash: Terminal,
  Read: FileText,
  read: FileText,
  Write: Pencil,
  write: Pencil,
  Edit: Pencil,
  edit: Pencil,
  Glob: Search,
  glob: Search,
  Grep: Search,
  grep: Search,
  NotebookEdit: Pencil,
}

function parseToolContent(content: string): { toolName: string; body: string } {
  // Format from emitTaskEvent: "[ToolName] content"
  const match = content.match(/^\[([^\]]+)\]\s*(.*)$/s)
  if (match) {
    return { toolName: match[1], body: match[2] }
  }
  return { toolName: 'Tool', body: content }
}

function isJSON(str: string): boolean {
  const trimmed = str.trim()
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
         (trimmed.startsWith('[') && trimmed.endsWith(']'))
}

function tryPrettyJSON(str: string): string | null {
  try {
    const parsed = JSON.parse(str)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return null
  }
}

function getSummary(body: string): string {
  const firstLine = body.split('\n')[0].trim()
  if (firstLine.length > 80) return firstLine.slice(0, 80) + '...'
  return firstLine
}

export const ToolOutput = React.memo(function ToolOutput({ content }: ToolOutputProps) {
  const [expanded, setExpanded] = useState(false)
  const { toolName, body } = useMemo(() => parseToolContent(content), [content])

  const Icon = toolIconMap[toolName] || Wrench
  const summary = useMemo(() => getSummary(body), [body])
  const prettyBody = useMemo(() => {
    if (isJSON(body)) return tryPrettyJSON(body)
    return null
  }, [body])

  return (
    <div className="my-1">
      {/* Header - clickable */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="flex items-center gap-1.5 w-full text-left group"
      >
        <ChevronRight
          size={10}
          className={`text-zinc-600 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
        />
        <Icon size={11} className="text-zinc-500 flex-shrink-0" />
        <span className="text-[10px] font-medium text-zinc-400">{toolName}</span>
        {!expanded && (
          <span className="text-[10px] text-zinc-600 truncate">{summary}</span>
        )}
      </button>

      {/* Body - collapsible */}
      {expanded && (
        <div className="ml-5 mt-1">
          <div className="relative">
            <div className="absolute top-1 right-1 z-10">
              <CopyButton text={body} />
            </div>
            {prettyBody ? (
              <CodeBlock code={prettyBody} language="json" />
            ) : (
              <pre className="text-[10px] text-zinc-500 font-mono whitespace-pre-wrap break-all bg-white/[0.03] rounded-lg p-2 pr-8">
                {body}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
})
