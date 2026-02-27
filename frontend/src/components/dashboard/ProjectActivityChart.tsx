import { memo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { ChartContainer } from './ChartContainer'
import { CHART_THEME, tooltipStyle } from './ChartTheme'
import type { ProjectActivityInfo } from '../../types'

interface Props {
  data: ProjectActivityInfo[]
}

export const ProjectActivityChart = memo(function ProjectActivityChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-[#111114] border border-white/[0.06] rounded-xl p-5 shadow-card flex flex-col items-center justify-center min-h-[280px]">
        <p className="text-sm text-zinc-600">No project data yet</p>
      </div>
    )
  }

  // Sort by session count descending, take top 5
  const sorted = [...data].sort((a, b) => b.session_count - a.session_count).slice(0, 5)

  return (
    <div className="bg-[#111114] border border-white/[0.06] rounded-xl p-5 shadow-card">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Project Activity</h3>
      <ChartContainer width="100%" height={Math.max(160, sorted.length * 40)}>
        {(w, h) => (
          <BarChart width={w} height={h} data={sorted} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
            <XAxis
              type="number"
              tick={{ fill: CHART_THEME.tickColor, fontSize: CHART_THEME.fontSize }}
              axisLine={{ stroke: CHART_THEME.axisLineColor }}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="project_name"
              tick={{ fill: '#d4d4d8', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={100}
            />
            <Tooltip
              {...tooltipStyle}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={((value: any, name: any) => [value ?? 0, name === 'session_count' ? 'Sessions' : 'Tasks']) as any}
            />
            <Bar dataKey="session_count" name="Sessions" fill="#60a5fa" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false} />
          </BarChart>
        )}
      </ChartContainer>
      {/* Test/Build pass rates */}
      <div className="mt-3 space-y-1.5">
        {sorted.map((p) => (
          <div key={p.project_id} className="flex items-center gap-3 text-xs">
            <span className="text-zinc-400 truncate flex-1 max-w-[120px]">{p.project_name}</span>
            <div className="flex items-center gap-3">
              <span className="text-zinc-500">
                Tests: {p.test_pass_rate > 0 ? (
                  <span className={p.test_pass_rate >= 80 ? 'text-emerald-400' : p.test_pass_rate >= 50 ? 'text-amber-400' : 'text-red-400'}>
                    {p.test_pass_rate.toFixed(0)}%
                  </span>
                ) : <span className="text-zinc-600">N/A</span>}
              </span>
              <span className="text-zinc-500">
                Build: {p.build_pass_rate > 0 ? (
                  <span className={p.build_pass_rate >= 80 ? 'text-emerald-400' : p.build_pass_rate >= 50 ? 'text-amber-400' : 'text-red-400'}>
                    {p.build_pass_rate.toFixed(0)}%
                  </span>
                ) : <span className="text-zinc-600">N/A</span>}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
