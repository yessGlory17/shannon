import { useRef, useCallback } from 'react'
import Editor, { type OnMount, type BeforeMount } from '@monaco-editor/react'
import type { editor, languages, IDisposable } from 'monaco-editor'
import {
  LANGUAGE_ID,
  languageConfiguration,
  monarchTokensProvider,
  TAG_SNIPPETS,
} from './claudePromptLanguage'
import { THEME_ID, claudeZincDarkTheme } from './claudePromptTheme'

interface ClaudePromptEditorProps {
  value: string
  onChange: (value: string) => void
  height?: string
}

// Category icons for autocomplete grouping
const CATEGORY_KIND: Record<string, number> = {
  Role: 14,       // Enum (colored square)
  Structure: 7,   // Class
  Context: 5,     // Field
  Tool: 1,        // Method
  Thinking: 24,   // TypeParameter
  Artifact: 6,    // Variable
  Template: 12,   // Value
  Markdown: 15,   // Snippet
  Pattern: 15,    // Snippet
}

export function ClaudePromptEditor({
  value,
  onChange,
  height = '350px',
}: ClaudePromptEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const disposablesRef = useRef<IDisposable[]>([])

  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    // Register language (idempotent check)
    if (!monaco.languages.getLanguages().some((lang) => lang.id === LANGUAGE_ID)) {
      monaco.languages.register({
        id: LANGUAGE_ID,
        aliases: ['Claude Prompt', 'claude-prompt', 'claude'],
        mimetypes: ['text/x-claude-prompt'],
      })
    }

    // Always re-set providers (they may have been disposed)
    monaco.languages.setMonarchTokensProvider(LANGUAGE_ID, monarchTokensProvider)
    monaco.languages.setLanguageConfiguration(LANGUAGE_ID, languageConfiguration)

    // Define theme
    monaco.editor.defineTheme(THEME_ID, claudeZincDarkTheme)
  }, [])

  const handleMount: OnMount = useCallback((editorInstance, monaco) => {
    editorRef.current = editorInstance

    // Dispose previous completions if any (handles remount)
    disposablesRef.current.forEach((d) => d.dispose())
    disposablesRef.current = []

    // ── Completion Provider: XML Tag Snippets ───────────────────
    const tagCompletion = monaco.languages.registerCompletionItemProvider(LANGUAGE_ID, {
      triggerCharacters: ['<', '/'],
      provideCompletionItems: (model, position) => {
        const lineContent = model.getLineContent(position.lineNumber)
        const textBefore = lineContent.substring(0, position.column - 1)

        // Determine the range to replace
        const word = model.getWordUntilPosition(position)
        const range: languages.CompletionItem['range'] = {
          startLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: word.endColumn,
        } as any

        const suggestions: languages.CompletionItem[] = []

        // After `<` or `</` - suggest tag names
        if (textBefore.match(/<\/?[\w:.-]*$/)) {
          // Check if this is a closing tag
          const isClosing = textBefore.endsWith('</')

          if (isClosing) {
            // For closing tags, find the nearest unclosed opening tag
            const fullText = model.getValue()
            const offset = model.getOffsetAt(position)
            const textSoFar = fullText.substring(0, offset)

            // Simple stack-based tag matching
            const openTags: string[] = []
            const tagRegex = /<\/?([a-zA-Z][\w:.-]*)/g
            let m: RegExpExecArray | null
            while ((m = tagRegex.exec(textSoFar)) !== null) {
              if (m[0].startsWith('</')) {
                // Closing tag - pop from stack
                const idx = openTags.lastIndexOf(m[1])
                if (idx !== -1) openTags.splice(idx, 1)
              } else {
                // Opening tag - check if self-closing
                const afterTag = textSoFar.substring(m.index + m[0].length)
                if (!afterTag.match(/^[^>]*\/>/)) {
                  openTags.push(m[1])
                }
              }
            }

            // Suggest closing the most recent unclosed tag
            if (openTags.length > 0) {
              const lastOpen = openTags[openTags.length - 1]
              suggestions.push({
                label: `/${lastOpen}>`,
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: `${lastOpen}>`,
                detail: `Close <${lastOpen}>`,
                range,
                sortText: '0000',
                preselect: true,
              } as languages.CompletionItem)
            }

            // Also suggest all known tags as closing options
            for (const snippet of TAG_SNIPPETS) {
              if (snippet.insertText.startsWith('<')) {
                const tagName = snippet.label
                suggestions.push({
                  label: `/${tagName}>`,
                  kind: CATEGORY_KIND[snippet.category] ?? 15,
                  insertText: `${tagName}>`,
                  detail: `Close <${tagName}>`,
                  documentation: snippet.detail,
                  range,
                  sortText: `1_${snippet.category}_${tagName}`,
                } as languages.CompletionItem)
              }
            }
          } else {
            // Opening tag suggestions
            for (const snippet of TAG_SNIPPETS) {
              suggestions.push({
                label: snippet.label,
                kind: CATEGORY_KIND[snippet.category] ?? 15,
                insertText: snippet.insertText,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                detail: `[${snippet.category}] ${snippet.detail}`,
                documentation: { value: `**${snippet.category}**: ${snippet.detail}` },
                range,
                sortText: `0_${snippet.category}_${snippet.label}`,
              } as languages.CompletionItem)
            }
          }
        }

        // After `{{` - suggest common variable names
        if (textBefore.match(/\{\{[\w.-]*$/)) {
          const commonVars = [
            'user_input', 'context', 'question', 'text', 'language',
            'format', 'topic', 'name', 'role', 'task', 'style',
            'tone', 'max_length', 'examples', 'instructions',
            'current_date', 'document', 'query', 'response_format',
          ]
          for (const v of commonVars) {
            suggestions.push({
              label: v,
              kind: monaco.languages.CompletionItemKind.Variable,
              insertText: `${v}}}`,
              detail: 'Template variable',
              range,
              sortText: `2_${v}`,
            } as languages.CompletionItem)
          }
        }

        return { suggestions }
      },
    })
    disposablesRef.current.push(tagCompletion)

    // ── Hover Provider: Tag documentation ───────────────────────
    const hoverProvider = monaco.languages.registerHoverProvider(LANGUAGE_ID, {
      provideHover: (model, position) => {
        const word = model.getWordAtPosition(position)
        if (!word) return null

        const line = model.getLineContent(position.lineNumber)
        const before = line.substring(0, word.startColumn - 1)

        // Check if word is inside a tag
        if (before.match(/<\/?$/) || before.match(/<[\w:.-]*$/)) {
          const snippet = TAG_SNIPPETS.find((s) => s.label === word.word)
          if (snippet) {
            return {
              range: {
                startLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endLineNumber: position.lineNumber,
                endColumn: word.endColumn,
              },
              contents: [
                { value: `**\`<${snippet.label}>\`** *(${snippet.category})*` },
                { value: snippet.detail },
              ],
            }
          }
        }

        // Template variable hover
        const lineContent = model.getLineContent(position.lineNumber)
        const varMatch = lineContent.match(/\{\{([\w.-]+)\}\}/)
        if (varMatch) {
          const varStart = lineContent.indexOf(varMatch[0]) + 1
          const varEnd = varStart + varMatch[0].length
          if (position.column >= varStart && position.column <= varEnd) {
            return {
              range: {
                startLineNumber: position.lineNumber,
                startColumn: varStart,
                endLineNumber: position.lineNumber,
                endColumn: varEnd,
              },
              contents: [
                { value: `**Template Variable**: \`${varMatch[1]}\`` },
                { value: 'Will be replaced with dynamic content at runtime.' },
              ],
            }
          }
        }

        return null
      },
    })
    disposablesRef.current.push(hoverProvider)

    editorInstance.focus()
  }, [])

  return (
    <div className="h-full border border-zinc-700 rounded-md overflow-hidden">
      <Editor
        height={height}
        language={LANGUAGE_ID}
        theme={THEME_ID}
        value={value}
        onChange={(val) => onChange(val ?? '')}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        loading={
          <div className="flex items-center justify-center h-full bg-zinc-800">
            <span className="text-sm text-zinc-500">Loading editor...</span>
          </div>
        }
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "'Fira Code', monospace",
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          wrappingIndent: 'indent',
          tabSize: 2,
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: 'line',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          bracketPairColorization: { enabled: true },
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          automaticLayout: true,
          suggest: {
            showSnippets: true,
            showWords: true,
            snippetsPreventQuickSuggestions: false,
          },
          quickSuggestions: {
            other: true,
            strings: true,
            comments: false,
          },
          scrollbar: {
            verticalScrollbarSize: 6,
            horizontalScrollbarSize: 6,
          },
          // Folding for XML tags
          folding: true,
          foldingStrategy: 'indentation',
          showFoldingControls: 'mouseover',
        }}
      />
    </div>
  )
}
