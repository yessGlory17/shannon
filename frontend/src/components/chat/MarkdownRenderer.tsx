import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { CodeBlock } from './CodeBlock'

interface MarkdownRendererProps {
  content: string
  className?: string
}

// Hoisted to module level — avoids creating a new array reference on every render,
// which would cause react-markdown to re-process its AST pipeline.
const remarkPlugins = [remarkGfm]

const components: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    const codeString = String(children).replace(/\n$/, '')

    // Fenced code block (has language class or is inside <pre>)
    if (match || (props.node?.position && codeString.includes('\n'))) {
      return <CodeBlock code={codeString} language={match?.[1]} />
    }

    // Inline code
    return (
      <code className="bg-white/[0.08] px-1 py-0.5 rounded text-[11px] font-mono text-blue-400" {...props}>
        {children}
      </code>
    )
  },
  pre({ children }) {
    // The pre wrapper is handled by CodeBlock, so just pass children through
    return <>{children}</>
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:underline"
      >
        {children}
      </a>
    )
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="text-[11px] border-collapse border border-white/[0.08]">
          {children}
        </table>
      </div>
    )
  },
  th({ children }) {
    return (
      <th className="border border-white/[0.08] px-2 py-1 text-left font-medium text-zinc-200 bg-white/[0.04]">
        {children}
      </th>
    )
  },
  td({ children }) {
    return (
      <td className="border border-white/[0.08] px-2 py-1 text-zinc-400">
        {children}
      </td>
    )
  },
  ul({ children }) {
    return <ul className="list-disc ml-4 space-y-0.5">{children}</ul>
  },
  ol({ children }) {
    return <ol className="list-decimal ml-4 space-y-0.5">{children}</ol>
  },
  li({ children }) {
    return <li className="text-zinc-300">{children}</li>
  },
  h1({ children }) {
    return <h1 className="text-base font-medium text-zinc-200 mb-2 mt-3 first:mt-0">{children}</h1>
  },
  h2({ children }) {
    return <h2 className="text-sm font-medium text-zinc-200 mb-1.5 mt-2.5 first:mt-0">{children}</h2>
  },
  h3({ children }) {
    return <h3 className="text-xs font-medium text-zinc-200 mb-1 mt-2 first:mt-0">{children}</h3>
  },
  h4({ children }) {
    return <h4 className="text-xs font-medium text-zinc-300 mb-1 mt-2 first:mt-0">{children}</h4>
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-white/[0.15] pl-3 my-2 text-zinc-400 italic">
        {children}
      </blockquote>
    )
  },
  strong({ children }) {
    return <strong className="font-semibold text-zinc-200">{children}</strong>
  },
  em({ children }) {
    return <em className="italic">{children}</em>
  },
  p({ children }) {
    return <p className="mb-2 last:mb-0">{children}</p>
  },
  hr() {
    return <hr className="border-white/[0.08] my-3" />
  },
}

export const MarkdownRenderer = React.memo(function MarkdownRenderer({
  content,
  className = '',
}: MarkdownRendererProps) {
  if (!content) return null

  return (
    <div className={`markdown-content text-xs text-zinc-300 leading-relaxed ${className}`}>
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
})
