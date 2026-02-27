import { memo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { ChartContainer } from './ChartContainer'
import { CHART_THEME, tooltipStyle } from './ChartTheme'
import type { AgentPerformance } from '../../types'

interface Props {
  data: AgentPerformance[]
}

export const AgentLeaderboard = memo(function AgentLeaderboard({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-[#111114] border border-white/[0.06] rounded-xl p-5 shadow-card flex flex-col items-center justify-center min-h-[280px]">
        <p className="text-sm text-zinc-600">No agent data yet</p>
      </div>
    )
  }

  const chartHeight = Math.max(200, data.length * 44)

  return (
    <div className="bg-[#111114] border border-white/[0.06] rounded-xl p-5 shadow-card">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Agent Leaderboard</h3>
      <ChartContainer width="100%" height={chartHeight}>
        {(w, h) => (
          <BarChart width={w} height={h} data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
            <XAxis
              type="number"
              tick={{ fill: CHART_THEME.tickColor, fontSize: CHART_THEME.fontSize }}
              axisLine={{ stroke: CHART_THEME.axisLineColor }}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="agent_name"
              tick={{ fill: '#d4d4d8', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={100}
            />
            <Tooltip
              {...tooltipStyle}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((value: any, name: any) => [value ?? 0, name === 'completed' ? 'Completed' : 'Failed']) as any}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, color: '#a1a1aa', paddingTop: 8 }}
            />
            <Bar
              dataKey="completed"
              name="Completed"
              stackId="a"
              fill="#34d399"
              radius={[0, 0, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="failed"
              name="Failed"
              stackId="a"
              fill="#f87171"
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        )}
      </ChartContainer>
      {/* Success rates underneath */}
      <div className="mt-3 space-y-1.5">
        {data.map((agent) => (
          <div key={agent.agent_id} className="flex items-center justify-between text-xs">
            <span className="text-zinc-500 truncate max-w-[140px]">{agent.agent_name}</span>
            <div className="flex items-center gap-2">
              <span className="text-zinc-600 uppercase">{agent.model}</span>
              <span className={agent.success_rate >= 80 ? 'text-emerald-400' : agent.success_rate >= 50 ? 'text-amber-400' : 'text-red-400'}>
                {agent.success_rate.toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
