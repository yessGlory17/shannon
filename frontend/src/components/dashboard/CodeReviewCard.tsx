import { memo } from 'react'
import { GitPullRequest, FileCode, CheckCircle, XCircle } from 'lucide-react'
import type { CodeReviewStats } from '../../types'

interface Props {
  data: CodeReviewStats | null
}

export const CodeReviewCard = memo(function CodeReviewCard({ data }: Props) {
  const pending = data?.pending_reviews ?? 0
  const files = data?.files_changed ?? 0
  const accepted = data?.accepted_tasks ?? 0
  const rejected = data?.rejected_tasks ?? 0
  const total = accepted + rejected
  const acceptPct = total > 0 ? (accepted / total) * 100 : 0

  return (
    <div className="bg-[#111114] border border-white/[0.06] rounded-xl p-5 shadow-card min-h-[280px]">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Code Review</h3>
      <div className="space-y-4">
        {/* Pending reviews */}
        <div className="flex items-center gap-3">
          <div className="bg-amber-400/10 w-8 h-8 rounded-lg flex items-center justify-center">
            <GitPullRequest size={15} className="text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-zinc-500">Pending Reviews</p>
            <p className="text-lg font-semibold text-zinc-100">{pending}</p>
          </div>
        </div>

        {/* Files changed */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-400/10 w-8 h-8 rounded-lg flex items-center justify-center">
            <FileCode size={15} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-zinc-500">Files Changed</p>
            <p className="text-lg font-semibold text-zinc-100">{files}</p>
          </div>
        </div>

        {/* Accept/Reject ratio */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle size={11} />
              <span>{accepted} accepted</span>
            </div>
            <div className="flex items-center gap-1 text-red-400">
              <XCircle size={11} />
              <span>{rejected} rejected</span>
            </div>
          </div>
          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden flex">
            {total > 0 && (
              <>
                <div
                  className="h-full bg-emerald-400"
                  style={{ width: `${acceptPct}%` }}
                />
                <div
                  className="h-full bg-red-400"
                  style={{ width: `${100 - acceptPct}%` }}
                />
              </>
            )}
          </div>
          {total > 0 && (
            <p className="text-xs text-zinc-500 text-center mt-1.5">{acceptPct.toFixed(0)}% accept rate</p>
          )}
        </div>
      </div>
    </div>
  )
})
