import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Titlebar } from './Titlebar'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex flex-col h-screen bg-[#09090b]">
      <Titlebar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6 min-w-0 page-scroll">
          {children}
        </main>
      </div>
    </div>
  )
}
