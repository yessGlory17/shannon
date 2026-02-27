import { Download, Check, Loader2, AlertTriangle, Package, ShieldCheck } from 'lucide-react'
import type { MCPCatalogItem } from '../../types'

interface CatalogCardProps {
  item: MCPCatalogItem
  installed: boolean
  installing: boolean
  error: boolean
  onInstall: () => void
  formatUseCount: (n: number) => string
}

export function CatalogCard({
  item,
  installed,
  installing,
  error,
  onInstall,
  formatUseCount,
}: CatalogCardProps) {
  return (
    <div className="rounded-xl bg-[#111114] border border-white/[0.06] hover:border-white/[0.10] shadow-card hover:shadow-card-hover p-4 flex flex-col transition-colors duration-200">
      <div className="flex items-start gap-3 mb-3">
        {item.iconUrl ? (
          <img
            src={item.iconUrl}
            alt=""
            className="w-10 h-10 rounded-lg bg-white/[0.06] object-cover flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
            <Package size={20} className="text-zinc-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-medium text-zinc-200 truncate">{item.displayName}</h3>
            {item.verified && (
              <ShieldCheck size={13} className="text-blue-400 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-zinc-600 truncate font-mono">{item.qualifiedName}</p>
        </div>
      </div>

      <p className="text-xs text-zinc-400 line-clamp-2 flex-1 mb-3">
        {item.description || 'No description available'}
      </p>

      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2">
          {item.useCount > 0 && (
            <span className="text-xs text-zinc-600">
              {formatUseCount(item.useCount)} uses
            </span>
          )}
          {item.verified && (
            <span className="px-1.5 py-0.5 bg-blue-600/10 text-blue-400 rounded text-[10px]">Verified</span>
          )}
        </div>

        {installed ? (
          <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/10 text-emerald-400 rounded text-xs border border-emerald-600/20">
            <Check size={12} />
            Installed
          </span>
        ) : installing ? (
          <span className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 text-zinc-400 rounded text-xs border border-zinc-700">
            <Loader2 size={12} className="animate-spin" />
            Installing...
          </span>
        ) : error ? (
          <span className="flex items-center gap-1 px-2.5 py-1 bg-red-600/10 text-red-400 rounded text-xs border border-red-600/20">
            <AlertTriangle size={12} />
            Failed
          </span>
        ) : (
          <button
            onClick={onInstall}
            className="flex items-center gap-1 px-2.5 py-1 bg-brand-gradient hover:opacity-90 text-white rounded-lg text-xs font-medium transition-colors shadow-brand-sm"
          >
            <Download size={12} />
            Install
          </button>
        )}
      </div>
    </div>
  )
}
