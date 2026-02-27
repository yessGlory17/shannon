import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'

interface CopyButtonProps {
  text: string
  className?: string
}

export function CopyButton({ text, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: noop
    }
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className={`p-1 rounded transition-colors ${
        copied
          ? 'text-emerald-400'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]'
      } ${className}`}
      title={copied ? 'Copied!' : 'Copy'}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}
