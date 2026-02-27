import { memo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { ChartContainer } from './ChartContainer'
import { CHART_THEME, CHART_PALETTE, tooltipStyle } from './ChartTheme'
import type { StatusCount, TeamActivityInfo } from '../../types'

interface Props {
  teams: TeamActivityInfo[]
  strategyDist: StatusCount[]
}

const strategyColors: Record<string, string> = {
  parallel: '#60a5fa',
  sequential: '#a78bfa',
  planner: '#34d399',
}

export const TeamActivityChart = memo(function TeamActivityChart({ teams, strategyDist }: Props) {
  const hasTeams = teams && teams.length > 0
  const hasStrategy = strategyDist && strategyDist.length > 0

  if (!hasTeams && !hasStrategy) {
    return (
      <div className="bg-[#111114] border border-white/[0.06] rounded-xl p-5 shadow-card flex flex-col items-center justify-center min-h-[280px]">
        <p className="text-sm text-zinc-600">No team data yet</p>
      </div>
    )
  }

  return (
    <div className="bg-[#111114] border border-white/[0.06] rounded-xl p-5 shadow-card">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Team Activity</h3>
      <div className="flex gap-4">
        {/* Team bar chart */}
        <div className="flex-1 min-w-0">
          {hasTeams ? (
            <ChartContainer width="100%" height={200}>
              {(w, h) => (
                <BarChart width={w} height={h} data={teams} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="team_name"
                    tick={{ fill: CHART_THEME.tickColor, fontSize: 10 }}
                    axisLine={{ stroke: CHART_THEME.axisLineColor }}
                    tickLine={false}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fill: CHART_THEME.tickColor, fontSize: CHART_THEME.fontSize }}
                    axisLine={{ stroke: CHART_THEME.axisLineColor }}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="task_count" name="Tasks" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    {teams.map((_, i) => (
                      <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ChartContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-xs text-zinc-600">No tasks assigned to teams</p>
            </div>
          )}
        </div>

        {/* Strategy mini donut */}
        {hasStrategy && (
          <div className="w-[140px] flex-shrink-0">
            <p className="text-xs text-zinc-500 text-center mb-1">Strategy</p>
            <ChartContainer width="100%" height={120}>
              {(w, h) => (
                <PieChart width={w} height={h}>
                  <Pie
                    data={strategyDist}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={48}
                    paddingAngle={3}
                    isAnimationActive={false}
                  >
                    {strategyDist.map((entry, i) => (
                      <Cell key={i} fill={strategyColors[entry.label] ?? CHART_PALETTE[i]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              )}
            </ChartContainer>
            <div className="space-y-1 mt-1">
              {strategyDist.map((entry) => (
                <div key={entry.label} className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <div className="w-2 h-2 rounded-full" style={{ background: strategyColors[entry.label] ?? '#71717a' }} />
                  <span className="capitalize flex-1">{entry.label}</span>
                  <span className="text-zinc-600">{entry.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
