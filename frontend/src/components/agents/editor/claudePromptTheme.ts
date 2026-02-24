import type { editor } from 'monaco-editor'

export const THEME_ID = 'claude-zinc-dark'

export const claudeZincDarkTheme: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    // ── Base text ──────────────────────────────────────────────
    { token: 'text', foreground: 'D4D4D8' },                  // zinc-300
    { token: 'white', foreground: 'D4D4D8' },

    // ── XML Tags (categorized) ─────────────────────────────────
    // Role tags - bold emerald (most important)
    { token: 'tag.role', foreground: '34D399', fontStyle: 'bold' },      // emerald-400
    // Structural tags - cyan
    { token: 'tag.structural', foreground: '22D3EE', fontStyle: 'bold' }, // cyan-400
    // Context tags - sky blue
    { token: 'tag.context', foreground: '38BDF8', fontStyle: 'bold' },    // sky-400
    // Tool tags - amber
    { token: 'tag.tool', foreground: 'FBBF24', fontStyle: 'bold' },      // amber-400
    // Thinking tags - violet
    { token: 'tag.thinking', foreground: 'A78BFA', fontStyle: 'bold' },   // violet-400
    // Artifact tags - pink
    { token: 'tag.artifact', foreground: 'F472B6', fontStyle: 'bold' },   // pink-400
    // Generic/custom tags - emerald (default)
    { token: 'tag', foreground: '34D399' },                              // emerald-400

    // ── XML Attributes ─────────────────────────────────────────
    { token: 'attribute.name', foreground: '67E8F9' },         // cyan-300
    { token: 'attribute.value', foreground: 'FCA5A5' },        // red-300
    { token: 'delimiter', foreground: 'A1A1AA' },              // zinc-400

    // ── Template Variables ─────────────────────────────────────
    { token: 'variable.template', foreground: 'FBBF24', fontStyle: 'bold' },    // amber-400  {{var}}
    { token: 'variable.interpolation', foreground: 'FB923C', fontStyle: 'bold' }, // orange-400 ${var}
    { token: 'variable.env', foreground: 'F59E0B' },                             // amber-500  $VAR

    // ── Markdown Headers ───────────────────────────────────────
    { token: 'keyword.header', foreground: '60A5FA', fontStyle: 'bold' },         // blue-400
    { token: 'keyword.header.content', foreground: '93C5FD', fontStyle: 'bold' }, // blue-300

    // ── Markdown Lists ─────────────────────────────────────────
    { token: 'keyword.list', foreground: '60A5FA' },            // blue-400
    { token: 'keyword.list.number', foreground: '60A5FA' },     // blue-400
    { token: 'keyword.checkbox', foreground: '34D399' },        // emerald-400

    // ── Markdown Formatting ────────────────────────────────────
    { token: 'markup.bold', foreground: 'E4E4E7', fontStyle: 'bold' },           // zinc-200
    { token: 'markup.italic', foreground: 'E4E4E7', fontStyle: 'italic' },       // zinc-200
    { token: 'markup.bold.italic', foreground: 'E4E4E7', fontStyle: 'bold italic' },
    { token: 'markup.strikethrough', foreground: '71717A', fontStyle: 'strikethrough' }, // zinc-500

    // ── Markdown Links & Images ────────────────────────────────
    { token: 'markup.link', foreground: '60A5FA' },             // blue-400
    { token: 'markup.link.text', foreground: '93C5FD' },        // blue-300
    { token: 'markup.image', foreground: 'A78BFA' },            // violet-400
    { token: 'markup.image.alt', foreground: 'C4B5FD' },        // violet-300

    // ── Markdown Tables & Rules ────────────────────────────────
    { token: 'keyword.table', foreground: '71717A' },            // zinc-500
    { token: 'keyword.table.separator', foreground: '52525B' },  // zinc-600
    { token: 'keyword.hr', foreground: '52525B' },               // zinc-600
    { token: 'keyword.quote', foreground: '6EE7B7' },            // emerald-300

    // ── Strings & Code ─────────────────────────────────────────
    { token: 'string.code', foreground: 'A1A1AA', background: '27272A' },  // zinc-400
    { token: 'string.fence', foreground: '71717A' },                        // zinc-500
    { token: 'string.language', foreground: '60A5FA', fontStyle: 'italic' }, // blue-400
    { token: 'string.link', foreground: '60A5FA', fontStyle: 'underline' }, // blue-400
    { token: 'string.quoted', foreground: 'FCA5A5' },                       // red-300

    // ── Prompt-specific Constants ──────────────────────────────
    { token: 'constant.role', foreground: '34D399', fontStyle: 'bold' },    // emerald-400
    { token: 'constant.role.colon', foreground: '6EE7B7' },                 // emerald-300
    { token: 'constant.keyword', foreground: 'F87171', fontStyle: 'bold' }, // red-400
    { token: 'constant.keyword.colon', foreground: 'FCA5A5' },              // red-300
    { token: 'constant.caps', foreground: 'D4D4D8', fontStyle: 'bold' },    // zinc-300 bold
    { token: 'constant.entity', foreground: 'FB923C' },                     // orange-400
    { token: 'constant.escape', foreground: 'FB923C' },                     // orange-400

    // ── Comments ───────────────────────────────────────────────
    { token: 'comment', foreground: '52525B', fontStyle: 'italic' },  // zinc-600
  ],
  colors: {
    // ── Editor chrome ──────────────────────────────────────────
    'editor.background': '#27272A',                         // zinc-800
    'editor.foreground': '#D4D4D8',                         // zinc-300

    // Selection
    'editor.selectionBackground': '#34D39933',
    'editor.selectionHighlightBackground': '#34D39922',
    'editor.inactiveSelectionBackground': '#34D39918',

    // Find matches
    'editor.findMatchBackground': '#FBBF2440',
    'editor.findMatchHighlightBackground': '#FBBF2420',

    // Current line
    'editor.lineHighlightBackground': '#3F3F4640',
    'editor.lineHighlightBorder': '#00000000',

    // Cursor
    'editorCursor.foreground': '#34D399',

    // Line numbers
    'editorLineNumber.foreground': '#52525B',
    'editorLineNumber.activeForeground': '#A1A1AA',

    // Gutter
    'editorGutter.background': '#27272A',
    'editorGutter.addedBackground': '#34D39980',
    'editorGutter.modifiedBackground': '#60A5FA80',
    'editorGutter.deletedBackground': '#F8717180',

    // Indentation
    'editorIndentGuide.background': '#3F3F4640',
    'editorIndentGuide.activeBackground': '#52525B',

    // Bracket matching
    'editorBracketMatch.background': '#34D39920',
    'editorBracketMatch.border': '#34D39960',

    // Bracket pair colorization
    'editorBracketHighlight.foreground1': '#34D399',
    'editorBracketHighlight.foreground2': '#60A5FA',
    'editorBracketHighlight.foreground3': '#FBBF24',
    'editorBracketHighlight.foreground4': '#A78BFA',
    'editorBracketHighlight.foreground5': '#F472B6',
    'editorBracketHighlight.foreground6': '#22D3EE',

    // Scrollbar
    'scrollbar.shadow': '#00000000',
    'scrollbarSlider.background': '#3F3F4640',
    'scrollbarSlider.hoverBackground': '#52525B80',
    'scrollbarSlider.activeBackground': '#52525B',

    // Minimap
    'minimap.background': '#27272A',

    // Widgets (autocomplete, hover, etc.)
    'editorWidget.background': '#18181B',
    'editorWidget.border': '#3F3F46',
    'editorWidget.foreground': '#D4D4D8',
    'editorSuggestWidget.background': '#18181B',
    'editorSuggestWidget.border': '#3F3F46',
    'editorSuggestWidget.foreground': '#D4D4D8',
    'editorSuggestWidget.selectedBackground': '#34D39920',
    'editorSuggestWidget.highlightForeground': '#34D399',
    'editorHoverWidget.background': '#18181B',
    'editorHoverWidget.border': '#3F3F46',

    // Whitespace
    'editorWhitespace.foreground': '#3F3F4640',

    // Overview ruler
    'editorOverviewRuler.border': '#00000000',
    'editorOverviewRuler.findMatchForeground': '#FBBF2460',
    'editorOverviewRuler.selectionHighlightForeground': '#34D39960',
  },
}
