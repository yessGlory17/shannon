import { memo } from 'react'
import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { ChartContainer } from './ChartContainer'
import { getStatusColor, tooltipStyle } from './ChartTheme'
import type { StatusCount } from '../../types'

interface Props {
  data: StatusCount[]
}

export const TaskStatusChart = memo(function TaskStatusChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-[#111114] border border-white/[0.06] rounded-xl p-5 shadow-card flex flex-col items-center justify-center min-h-[280px]">
        <p className="text-sm text-zinc-600">No task data yet</p>
      </div>
    )
  }

  return (
    <div className="bg-[#111114] border border-white/[0.06] rounded-xl p-5 shadow-card">
      <h3 className="text-sm font-semibold text-zinc-300 mb-3">Task Status</h3>
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
              paddingAngle={2}
              isAnimationActive={false}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={getStatusColor(entry.label)} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        )}
      </ChartContainer>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2 justify-center">
        {data.map((entry) => (
          <div key={entry.label} className="flex items-center gap-1.5 text-xs text-zinc-400">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: getStatusColor(entry.label) }} />
            <span className="capitalize">{entry.label.replace('_', ' ')}</span>
            <span className="text-zinc-600">({entry.count})</span>
          </div>
        ))}
      </div>
    </div>
  )
})
