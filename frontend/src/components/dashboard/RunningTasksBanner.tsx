import { memo } from 'react'
import { Zap } from 'lucide-react'

interface Props {
  count: number
}

export const RunningTasksBanner = memo(function RunningTasksBanner({ count }: Props) {
  return (
    <div className="relative overflow-hidden bg-[#111114] border border-white/[0.06] rounded-xl p-4 shadow-card">
      <div className="absolute inset-0 bg-brand-gradient opacity-[0.04] pointer-events-none" />
      <div className="relative flex items-center gap-3">
        <div className="bg-amber-400/10 w-9 h-9 rounded-full flex items-center justify-center">
          <Zap size={16} className="text-amber-400" />
        </div>
        <div>
          <span className="text-xs text-zinc-500 block">Running Tasks</span>
          <p className="text-lg font-semibold text-zinc-100">{count}</p>
        </div>
        {count > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            <span className="text-xs text-emerald-400">Active</span>
          </div>
        )}
      </div>
    </div>
  )
})
