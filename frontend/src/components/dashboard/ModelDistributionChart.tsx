import { memo } from 'react'
import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { ChartContainer } from './ChartContainer'
import { CHART_COLORS, tooltipStyle } from './ChartTheme'
import type { StatusCount } from '../../types'

interface Props {
  data: StatusCount[]
}

const getModelColor = (label: string): string => {
  const lower = label.toLowerCase()
  if (lower.includes('opus')) return CHART_COLORS.opus
  if (lower.includes('haiku')) return CHART_COLORS.haiku
  if (lower.includes('sonnet')) return CHART_COLORS.sonnet
  return '#818cf8'
}

export const ModelDistributionChart = memo(function ModelDistributionChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-[#111114] border border-white/[0.06] rounded-xl p-5 shadow-card flex flex-col items-center justify-center min-h-[280px]">
        <p className="text-sm text-zinc-600">No model data yet</p>
      </div>
    )
  }

  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="bg-[#111114] border border-white/[0.06] rounded-xl p-5 shadow-card">
      <h3 className="text-sm font-semibold text-zinc-300 mb-3">Model Distribution</h3>
      <ChartContainer width="100%" height={180}>
        {(w, h) => (
          <PieChart width={w} height={h}>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={72}
              paddingAngle={3}
              isAnimationActive={false}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={getModelColor(entry.label)} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        )}
      </ChartContainer>
      <div className="space-y-2 mt-2">
        {data.map((entry) => {
          const pct = total > 0 ? ((entry.count / total) * 100).toFixed(0) : '0'
          return (
            <div key={entry.label} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: getModelColor(entry.label) }} />
              <span className="text-xs text-zinc-300 capitalize flex-1">{entry.label}</span>
              <span className="text-xs text-zinc-500">{entry.count}</span>
              <span className="text-xs text-zinc-600 w-8 text-right">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
})
