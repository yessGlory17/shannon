import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderOpen,
  Bot,
  Server,
  Users,
  Play,
  Settings,
} from 'lucide-react'
import logoSvg from '../../assets/images/logo.svg'

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/projects', label: 'Projects', icon: FolderOpen },
  { path: '/agents', label: 'Agents', icon: Bot },
  { path: '/mcp', label: 'MCP Servers', icon: Server },
  { path: '/teams', label: 'Teams', icon: Users },
  { path: '/sessions', label: 'Sessions', icon: Play },
]

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <aside className="w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-zinc-800 flex items-center gap-3">
        <img src={logoSvg} alt="Shannon" className="w-14 h-14" />
        <div>
          <h1 className="text-sm font-semibold text-zinc-100 tracking-tight leading-none">
            Shannon
          </h1>
          <p className="text-[10px] text-zinc-500 mt-0.5">for Claude Code</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 pt-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname === item.path || location.pathname.startsWith(item.path + '/') || (item.path === '/sessions' && location.pathname.startsWith('/workspace/'))
          const Icon = item.icon
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-zinc-800">
        <button
          onClick={() => navigate('/settings')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
        >
          <Settings size={18} />
          Settings
        </button>
      </div>
    </aside>
  )
}
