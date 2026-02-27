import { memo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { ChartContainer } from './ChartContainer'
import { CHART_THEME, tooltipStyle } from './ChartTheme'
import type { DailyCount } from '../../types'

interface Props {
  data: DailyCount[]
}

export const CompletionTrendChart = memo(function CompletionTrendChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-[#111114] border border-white/[0.06] rounded-xl p-5 shadow-card flex flex-col items-center justify-center min-h-[200px]">
        <p className="text-sm text-zinc-600">No completion data yet</p>
      </div>
    )
  }

  return (
    <div className="bg-[#111114] border border-white/[0.06] rounded-xl p-5 shadow-card">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Task Completion Trend (30 Days)</h3>
      <ChartContainer width="100%" height={220}>
        {(w, h) => (
          <AreaChart width={w} height={h} data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradFailed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f87171" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_THEME.gridColor} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fill: CHART_THEME.tickColor, fontSize: CHART_THEME.fontSize }}
              axisLine={{ stroke: CHART_THEME.axisLineColor }}
              tickLine={false}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis
              tick={{ fill: CHART_THEME.tickColor, fontSize: CHART_THEME.fontSize }}
              axisLine={{ stroke: CHART_THEME.axisLineColor }}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip {...tooltipStyle} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, color: '#a1a1aa', paddingTop: 8 }}
            />
            <Area
              type="monotone"
              dataKey="completed"
              name="Completed"
              stroke="#34d399"
              fill="url(#gradCompleted)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#34d399', stroke: '#18181b', strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="failed"
              name="Failed"
              stroke="#f87171"
              fill="url(#gradFailed)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#f87171', stroke: '#18181b', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        )}
      </ChartContainer>
    </div>
  )
})
