import React from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { CopyButton } from './CopyButton'

interface CodeBlockProps {
  code: string
  language?: string
}

const customStyle: React.CSSProperties = {
  margin: 0,
  padding: '12px 14px',
  fontSize: '11px',
  lineHeight: '1.5',
  borderRadius: '0 0 8px 8px',
  background: 'rgba(0, 0, 0, 0.3)',
  maxHeight: '400px',
  overflow: 'auto',
}

export const CodeBlock = React.memo(function CodeBlock({ code, language }: CodeBlockProps) {
  const displayLang = language || 'text'

  return (
    <div className="rounded-lg border border-white/[0.08] overflow-hidden my-2">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.04] border-b border-white/[0.06]">
        <span className="text-[10px] font-mono text-zinc-500">{displayLang}</span>
        <CopyButton text={code} />
      </div>
      {/* Code */}
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={customStyle}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
})
