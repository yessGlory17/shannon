import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title: string
  color?: string
}

export function SectionHeader({ icon: Icon, title, color = 'text-zinc-400' }: Props) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={16} className={color} />
      <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{title}</h2>
    </div>
  )
}
