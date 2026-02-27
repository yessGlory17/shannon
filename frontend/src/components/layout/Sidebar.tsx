import { memo } from 'react'
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
  { path: '/projects', label: 'Workspaces', icon: FolderOpen },
  { path: '/agents', label: 'Agents', icon: Bot },
  { path: '/mcp', label: 'MCP Servers', icon: Server },
  { path: '/teams', label: 'Teams', icon: Users },
  { path: '/sessions', label: 'Sessions', icon: Play },
]

export const Sidebar = memo(function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <aside className="w-56 bg-[#111114] border-r border-white/[0.06] flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-white/[0.06] flex items-center gap-3">
        <div className="relative">
          <img src={logoSvg} alt="Shannon" className="w-11 h-11" />
        </div>
        <div>
          <h1 className="text-sm font-bold font-display text-zinc-100 tracking-tight leading-none">
            Shannon
          </h1>
          <p className="text-[10px] text-zinc-600 mt-0.5 font-medium">for Claude Code</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 pt-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname === item.path || location.pathname.startsWith(item.path + '/') || (item.path === '/sessions' && location.pathname.startsWith('/workspace/'))
          const Icon = item.icon
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium  ${
                isActive
                  ? 'bg-brand-gradient-subtle text-zinc-100 shadow-inner-brand'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
              }`}
            >
              <Icon
                size={17}
                className={isActive ? 'text-brand-blue' : ''}
                strokeWidth={isActive ? 2 : 1.5}
              />
              {item.label}
              {isActive && (
                <div className="ml-auto w-1 h-4 rounded-full bg-brand-gradient opacity-70" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-white/[0.06]">
        <button
          onClick={() => navigate('/settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium  ${
            location.pathname === '/settings'
              ? 'bg-brand-gradient-subtle text-zinc-100 shadow-inner-brand'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
          }`}
        >
          <Settings
            size={17}
            className={location.pathname === '/settings' ? 'text-brand-blue' : ''}
            strokeWidth={location.pathname === '/settings' ? 2 : 1.5}
          />
          Settings
          {location.pathname === '/settings' && (
            <div className="ml-auto w-1 h-4 rounded-full bg-brand-gradient opacity-70" />
          )}
        </button>
      </div>
    </aside>
  )
})
