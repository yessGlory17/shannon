// Shared Recharts dark theme constants matching Shannon design system

export const CHART_COLORS: Record<string, string> = {
  // Task status colors
  completed: '#34d399',
  failed: '#f87171',
  running: '#60a5fa',
  pending: '#a1a1aa',
  queued: '#fbbf24',
  cancelled: '#71717a',
  awaiting_input: '#a78bfa',

  // Session status colors
  planning: '#818cf8',
  paused: '#fb923c',

  // Model colors
  sonnet: '#60a5fa',
  opus: '#a78bfa',
  haiku: '#34d399',
}

export const CHART_PALETTE = [
  '#60a5fa', '#a78bfa', '#34d399', '#fbbf24',
  '#f87171', '#fb923c', '#818cf8', '#f472b6',
]

export const CHART_THEME = {
  textColor: '#a1a1aa',
  gridColor: 'rgba(255,255,255,0.04)',
  axisLineColor: 'rgba(255,255,255,0.06)',
  tickColor: '#71717a',
  fontSize: 11,
}

export const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#18181b',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    fontSize: 12,
    color: '#e4e4e7',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  },
  itemStyle: { color: '#e4e4e7' },
  labelStyle: { color: '#71717a', marginBottom: 4 },
}

export function getStatusColor(label: string): string {
  return CHART_COLORS[label] ?? '#71717a'
}
