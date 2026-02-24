import type { languages } from 'monaco-editor'

export const LANGUAGE_ID = 'claude-prompt'

// ── Tag categories for semantic coloring ──────────────────────────────
// The tokenizer classifies XML tags into categories so the theme can
// color them differently (role tags vs structural vs tool-use, etc.)

const ROLE_TAGS = [
  'system', 'human', 'assistant', 'user',
]

const STRUCTURAL_TAGS = [
  'example', 'examples', 'instructions', 'rules', 'constraints',
  'guidelines', 'format', 'output_format', 'response_format',
  'task', 'goal', 'objective', 'purpose',
  'persona', 'role', 'identity', 'character',
  'preamble', 'postamble', 'setup', 'config',
]

const CONTEXT_TAGS = [
  'context', 'document', 'documents', 'source', 'reference',
  'data', 'input', 'output', 'file', 'content',
  'knowledge', 'information', 'background', 'metadata',
  'citation', 'quote', 'excerpt',
]

const TOOL_TAGS = [
  'tool_use', 'tool_result', 'tool', 'tools',
  'function', 'function_call', 'function_result',
  'invoke', 'parameter', 'parameters',
  'api', 'endpoint', 'request', 'response',
]

const THINKING_TAGS = [
  'thinking', 'think', 'scratchpad', 'reasoning',
  'analysis', 'reflection', 'chain_of_thought',
  'inner_monologue', 'step', 'steps',
  'answer', 'solution', 'conclusion',
]

const ARTIFACT_TAGS = [
  'artifact', 'antArtifact', 'antml:invoke', 'antml:parameter',
  'result', 'error', 'warning', 'code', 'codeblock',
]

// Combined set for quick lookup (used by completions, not tokenizer)
export const ALL_KNOWN_TAGS = [
  ...ROLE_TAGS, ...STRUCTURAL_TAGS, ...CONTEXT_TAGS,
  ...TOOL_TAGS, ...THINKING_TAGS, ...ARTIFACT_TAGS,
]

// ── Language Configuration ────────────────────────────────────────────

export const languageConfiguration: languages.LanguageConfiguration = {
  comments: {
    blockComment: ['<!--', '-->'],
  },
  brackets: [
    ['<', '>'],
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '<', close: '>', notIn: ['string'] },
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"', notIn: ['string'] },
    { open: "'", close: "'", notIn: ['string'] },
    { open: '`', close: '`', notIn: ['string'] },
    { open: '**', close: '**' },
    { open: '{{', close: '}}' },
  ],
  surroundingPairs: [
    { open: '<', close: '>' },
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: '`', close: '`' },
    { open: '**', close: '**' },
    { open: '*', close: '*' },
    { open: '_', close: '_' },
    { open: '~~', close: '~~' },
  ],
  folding: {
    markers: {
      start: /^\s*<[\w:.-]+/,
      end: /^\s*<\/[\w:.-]+>/,
    },
  },
  wordPattern: /(-?\d*\.\d\w*)|([^\s`~!@#%^&*()\-=+[{\]}\\|;:'",.<>/?\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]+)/,
  onEnterRules: [
    // Continue markdown lists
    {
      beforeText: /^\s*[-*+]\s/,
      action: { indentAction: 0 as languages.IndentAction, appendText: '- ' },
    },
    {
      beforeText: /^\s*(\d+)\.\s/,
      action: { indentAction: 0 as languages.IndentAction, appendText: '1. ' },
    },
    // Continue blockquotes
    {
      beforeText: /^\s*>\s/,
      action: { indentAction: 0 as languages.IndentAction, appendText: '> ' },
    },
  ],
}

// ── Monarch Tokenizer ─────────────────────────────────────────────────

export const monarchTokensProvider: languages.IMonarchLanguage = {
  defaultToken: 'text',
  tokenPostfix: '.claude',
  ignoreCase: false,

  // Tag classification arrays for the tokenizer cases
  roleTags: ROLE_TAGS,
  structuralTags: STRUCTURAL_TAGS,
  contextTags: CONTEXT_TAGS,
  toolTags: TOOL_TAGS,
  thinkingTags: THINKING_TAGS,
  artifactTags: ARTIFACT_TAGS,

  // Prompt-specific keywords that appear at the start of lines
  promptKeywords: [
    'IMPORTANT', 'NOTE', 'WARNING', 'CRITICAL', 'TODO', 'FIXME',
    'TIP', 'CAUTION', 'DANGER', 'INFO', 'REMEMBER', 'NEVER',
    'ALWAYS', 'MUST', 'DO NOT', 'REQUIRED', 'OPTIONAL',
  ],

  tokenizer: {
    // ── Root state ──────────────────────────────────────────────
    root: [
      // HTML comments <!-- ... -->
      [/<!--/, 'comment', '@comment'],

      // Fenced code blocks ```lang ... ```
      [/^(\s*)(```)(\w*)$/, ['white', 'string.fence', 'string.language']],
      [/^(\s*)(```)\s*(\w+)/, ['white', 'string.fence', 'string.language'], '@codeBlock'],
      [/^(\s*)(```)$/, ['white', 'string.fence'], '@codeBlock'],

      // Template variables (multiple formats)
      [/\{\{[\w.-]+\}\}/, 'variable.template'],
      [/\$\{[\w.-]+\}/, 'variable.interpolation'],
      [/\$[A-Z_][A-Z0-9_]*/, 'variable.env'],

      // XML tags - classified by category
      [/<\/([\w:.-]+)>/, { cases: {
        '$1@roleTags': 'tag.role',
        '$1@structuralTags': 'tag.structural',
        '$1@contextTags': 'tag.context',
        '$1@toolTags': 'tag.tool',
        '$1@thinkingTags': 'tag.thinking',
        '$1@artifactTags': 'tag.artifact',
        '@default': 'tag',
      }}],

      // XML self-closing
      [/<([\w:.-]+)\s*\/>/, { cases: {
        '$1@roleTags': 'tag.role',
        '$1@structuralTags': 'tag.structural',
        '$1@contextTags': 'tag.context',
        '$1@toolTags': 'tag.tool',
        '$1@thinkingTags': 'tag.thinking',
        '$1@artifactTags': 'tag.artifact',
        '@default': 'tag',
      }}],

      // XML opening tag (with possible attributes)
      [/<([\w:.-]+)/, { cases: {
        '$1@roleTags': { token: 'tag.role', next: '@xmlTag' },
        '$1@structuralTags': { token: 'tag.structural', next: '@xmlTag' },
        '$1@contextTags': { token: 'tag.context', next: '@xmlTag' },
        '$1@toolTags': { token: 'tag.tool', next: '@xmlTag' },
        '$1@thinkingTags': { token: 'tag.thinking', next: '@xmlTag' },
        '$1@artifactTags': { token: 'tag.artifact', next: '@xmlTag' },
        '@default': { token: 'tag', next: '@xmlTag' },
      }}],

      // ── Markdown block-level elements ─────────────────────────

      // Horizontal rules
      [/^(\s*)(---+|___+|\*\*\*+)\s*$/, ['white', 'keyword.hr']],

      // Headers
      [/^(\s*)(#{1,6})(\s+)(.*)$/, ['white', 'keyword.header', 'white', 'keyword.header.content']],

      // Blockquotes (nested)
      [/^(\s*)((?:>\s?)+)/, ['white', 'keyword.quote']],

      // Task lists
      [/^(\s*)([-*+])(\s+)(\[[ xX]\])/, ['white', 'keyword.list', 'white', 'keyword.checkbox']],

      // Unordered lists
      [/^(\s*)([-*+])(\s+)/, ['white', 'keyword.list', 'white']],

      // Ordered lists
      [/^(\s*\d+)(\.)(\s+)/, ['keyword.list.number', 'keyword.list', 'white']],

      // Tables
      [/^\|/, 'keyword.table', '@tableRow'],

      // ── Prompt-specific patterns ──────────────────────────────

      // Role markers at start of line: Human:, Assistant:, System:, User:
      [/^(Human|Assistant|System|User)(:)/, ['constant.role', 'constant.role.colon']],

      // Emphasized keywords at start of line: IMPORTANT:, NOTE:, etc.
      [/^(IMPORTANT|NOTE|WARNING|CRITICAL|TODO|FIXME|TIP|CAUTION|DANGER|INFO|REMEMBER|NEVER|ALWAYS|MUST|REQUIRED|OPTIONAL)(:)/, ['constant.keyword', 'constant.keyword.colon']],

      // DO NOT pattern
      [/\bDO NOT\b/, 'constant.keyword'],

      // ── Markdown inline elements ──────────────────────────────

      // Bold+italic ***text***
      [/\*\*\*[^*]+\*\*\*/, 'markup.bold.italic'],

      // Bold **text** or __text__
      [/\*\*[^*]+\*\*/, 'markup.bold'],
      [/__[^_]+__/, 'markup.bold'],

      // Italic *text* or _text_ (not after word char to avoid false matches)
      [/(?<!\w)\*[^*\n]+\*(?!\w)/, 'markup.italic'],
      [/(?<!\w)_[^_\n]+_(?!\w)/, 'markup.italic'],

      // Strikethrough ~~text~~
      [/~~[^~]+~~/, 'markup.strikethrough'],

      // Inline code `code`
      [/`[^`\n]+`/, 'string.code'],

      // Links [text](url)
      [/\[/, 'markup.link', '@markdownLink'],

      // Images ![alt](url)
      [/!\[/, 'markup.image', '@markdownImage'],

      // ── Strings ───────────────────────────────────────────────

      // Quoted strings (multi-word)
      [/"[^"\n]*"/, 'string.quoted'],
      [/'[^'\n]*'/, 'string.quoted'],

      // URLs
      [/https?:\/\/[^\s)>\]]+/, 'string.link'],

      // ── HTML entities ─────────────────────────────────────────
      [/&\w+;/, 'constant.entity'],
      [/&#\d+;/, 'constant.entity'],
      [/&#x[\dA-Fa-f]+;/, 'constant.entity'],

      // ── Escape sequences ──────────────────────────────────────
      [/\\[nrtbfv\\'"0]/, 'constant.escape'],

      // ── ALL CAPS emphasis (3+ chars, common in prompts) ───────
      [/\b[A-Z][A-Z_]{2,}\b/, 'constant.caps'],
    ],

    // ── XML tag interior (attributes) ───────────────────────────
    xmlTag: [
      [/\s+/, 'white'],
      [/([\w:.-]+)(\s*)(=)(\s*)/, ['attribute.name', 'white', 'delimiter', 'white']],
      [/"[^"]*"/, 'attribute.value'],
      [/'[^']*'/, 'attribute.value'],
      [/\{\{[\w.-]+\}\}/, 'variable.template'],
      [/\$\{[\w.-]+\}/, 'variable.interpolation'],
      [/\/>/, 'tag', '@pop'],
      [/>/, 'tag', '@pop'],
    ],

    // ── Fenced code block ───────────────────────────────────────
    codeBlock: [
      [/^(\s*)(```)\s*$/, ['white', 'string.fence'], '@pop'],
      [/.*$/, 'string.code'],
    ],

    // ── HTML comment ────────────────────────────────────────────
    comment: [
      [/-->/, 'comment', '@pop'],
      [/[^-]+/, 'comment'],
      [/./, 'comment'],
    ],

    // ── Markdown link [text](url) ───────────────────────────────
    markdownLink: [
      [/[^\]]+/, 'markup.link.text'],
      [/\](\()/, ['markup.link', { token: 'markup.link', next: '@markdownLinkUrl' }]],
      [/\]/, 'markup.link', '@pop'],
    ],

    markdownLinkUrl: [
      [/[^)]+/, 'string.link'],
      [/\)/, 'markup.link', '@popall'],
    ],

    // ── Markdown image ![alt](url) ──────────────────────────────
    markdownImage: [
      [/[^\]]+/, 'markup.image.alt'],
      [/\](\()/, ['markup.image', { token: 'markup.image', next: '@markdownImageUrl' }]],
      [/\]/, 'markup.image', '@pop'],
    ],

    markdownImageUrl: [
      [/[^)]+/, 'string.link'],
      [/\)/, 'markup.image', '@popall'],
    ],

    // ── Table row ───────────────────────────────────────────────
    tableRow: [
      [/\|/, 'keyword.table'],
      [/---+/, 'keyword.table.separator'],
      [/:?---+:?/, 'keyword.table.separator'],
      [/[^|\n]+/, 'text'],
      [/$/, '', '@pop'],
    ],
  },
}

// ── Completion Items ──────────────────────────────────────────────────
// Exported for use in the CompletionItemProvider registered in the editor

export interface TagSnippet {
  label: string
  insertText: string
  detail: string
  category: string
}

export const TAG_SNIPPETS: TagSnippet[] = [
  // Role tags
  { label: 'system', insertText: '<system>\n\t$0\n</system>', detail: 'System message block', category: 'Role' },
  { label: 'human', insertText: '<human>\n\t$0\n</human>', detail: 'Human message block', category: 'Role' },
  { label: 'assistant', insertText: '<assistant>\n\t$0\n</assistant>', detail: 'Assistant message block', category: 'Role' },
  { label: 'user', insertText: '<user>\n\t$0\n</user>', detail: 'User message block', category: 'Role' },

  // Structural tags
  { label: 'instructions', insertText: '<instructions>\n\t$0\n</instructions>', detail: 'Instructions block', category: 'Structure' },
  { label: 'rules', insertText: '<rules>\n\t$0\n</rules>', detail: 'Rules block', category: 'Structure' },
  { label: 'constraints', insertText: '<constraints>\n\t$0\n</constraints>', detail: 'Constraints block', category: 'Structure' },
  { label: 'guidelines', insertText: '<guidelines>\n\t$0\n</guidelines>', detail: 'Guidelines block', category: 'Structure' },
  { label: 'example', insertText: '<example>\n\t$0\n</example>', detail: 'Single example', category: 'Structure' },
  { label: 'examples', insertText: '<examples>\n\t<example>\n\t\t$0\n\t</example>\n</examples>', detail: 'Examples wrapper with example', category: 'Structure' },
  { label: 'format', insertText: '<format>\n\t$0\n</format>', detail: 'Output format definition', category: 'Structure' },
  { label: 'output_format', insertText: '<output_format>\n\t$0\n</output_format>', detail: 'Output format specification', category: 'Structure' },
  { label: 'task', insertText: '<task>\n\t$0\n</task>', detail: 'Task definition', category: 'Structure' },
  { label: 'persona', insertText: '<persona>\n\t$0\n</persona>', detail: 'Persona definition', category: 'Structure' },

  // Context tags
  { label: 'context', insertText: '<context>\n\t$0\n</context>', detail: 'Context information', category: 'Context' },
  { label: 'document', insertText: '<document>\n\t$0\n</document>', detail: 'Document content', category: 'Context' },
  { label: 'source', insertText: '<source>\n\t$0\n</source>', detail: 'Source reference', category: 'Context' },
  { label: 'reference', insertText: '<reference>\n\t$0\n</reference>', detail: 'Reference material', category: 'Context' },
  { label: 'data', insertText: '<data>\n\t$0\n</data>', detail: 'Data block', category: 'Context' },
  { label: 'input', insertText: '<input>\n\t$0\n</input>', detail: 'Input data', category: 'Context' },
  { label: 'output', insertText: '<output>\n\t$0\n</output>', detail: 'Expected output', category: 'Context' },
  { label: 'knowledge', insertText: '<knowledge>\n\t$0\n</knowledge>', detail: 'Knowledge base', category: 'Context' },

  // Tool tags
  { label: 'tool_use', insertText: '<tool_use>\n\t$0\n</tool_use>', detail: 'Tool usage block', category: 'Tool' },
  { label: 'tool_result', insertText: '<tool_result>\n\t$0\n</tool_result>', detail: 'Tool result block', category: 'Tool' },
  { label: 'function', insertText: '<function name="$1">\n\t$0\n</function>', detail: 'Function definition', category: 'Tool' },
  { label: 'parameters', insertText: '<parameters>\n\t$0\n</parameters>', detail: 'Parameters block', category: 'Tool' },

  // Thinking tags
  { label: 'thinking', insertText: '<thinking>\n\t$0\n</thinking>', detail: 'Chain-of-thought block', category: 'Thinking' },
  { label: 'scratchpad', insertText: '<scratchpad>\n\t$0\n</scratchpad>', detail: 'Scratchpad for reasoning', category: 'Thinking' },
  { label: 'reasoning', insertText: '<reasoning>\n\t$0\n</reasoning>', detail: 'Reasoning block', category: 'Thinking' },
  { label: 'answer', insertText: '<answer>\n\t$0\n</answer>', detail: 'Final answer block', category: 'Thinking' },
  { label: 'steps', insertText: '<steps>\n\t<step>\n\t\t$0\n\t</step>\n</steps>', detail: 'Steps wrapper', category: 'Thinking' },
  { label: 'step', insertText: '<step>\n\t$0\n</step>', detail: 'Single step', category: 'Thinking' },

  // Artifact tags
  { label: 'artifact', insertText: '<artifact type="$1" title="$2">\n\t$0\n</artifact>', detail: 'Artifact block', category: 'Artifact' },
  { label: 'result', insertText: '<result>\n\t$0\n</result>', detail: 'Result block', category: 'Artifact' },
  { label: 'error', insertText: '<error>\n\t$0\n</error>', detail: 'Error block', category: 'Artifact' },
  { label: 'code', insertText: '<code language="$1">\n\t$0\n</code>', detail: 'Code block with language', category: 'Artifact' },

  // Common prompt patterns (not XML)
  { label: 'variable', insertText: '{{$0}}', detail: 'Template variable {{name}}', category: 'Template' },
  { label: 'codeblock', insertText: '```$1\n$0\n```', detail: 'Fenced code block', category: 'Markdown' },
  { label: 'few-shot', insertText: '<examples>\n\t<example>\n\t\t<human>$1</human>\n\t\t<assistant>$2</assistant>\n\t</example>\n</examples>', detail: 'Few-shot example pattern', category: 'Pattern' },
  { label: 'chain-of-thought', insertText: '<instructions>\nBefore answering, think step by step inside <thinking> tags.\nThen provide your final answer inside <answer> tags.\n</instructions>', detail: 'Chain-of-thought pattern', category: 'Pattern' },
]
