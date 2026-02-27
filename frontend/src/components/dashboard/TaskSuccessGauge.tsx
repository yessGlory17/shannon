import { memo } from 'react'

interface Props {
  rate: number // 0-100
}

export const TaskSuccessGauge = memo(function TaskSuccessGauge({ rate }: Props) {
  const radius = 56
  const stroke = 8
  const circumference = 2 * Math.PI * radius
  const progress = (rate / 100) * circumference
  const color = rate >= 80 ? '#34d399' : rate >= 50 ? '#fbbf24' : '#f87171'
  const size = (radius + stroke) * 2

  return (
    <div className="bg-[#111114] border border-white/[0.06] rounded-xl p-5 shadow-card flex flex-col items-center min-h-[280px]">
      <h3 className="text-sm font-semibold text-zinc-300 mb-3 self-start">Success Rate</h3>
      <div className="flex-1 flex items-center justify-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="transform -rotate-90">
            <circle
              cx={radius + stroke}
              cy={radius + stroke}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={stroke}
            />
            <circle
              cx={radius + stroke}
              cy={radius + stroke}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="round"
              className=""
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-zinc-100">{rate.toFixed(0)}%</span>
            <span className="text-xs text-zinc-500 mt-0.5">Tasks</span>
          </div>
        </div>
      </div>
    </div>
  )
})
