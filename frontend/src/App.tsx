import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { Loader2 } from 'lucide-react'

// Eagerly loaded (lightweight, frequently visited)
import { SessionList } from './pages/SessionList'
import { AgentManager } from './pages/AgentManager'
import { Settings } from './pages/Settings'

// Lazy loaded (heavy dependencies: recharts, ReactFlow, Monaco)
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const ProjectSettings = lazy(() => import('./pages/ProjectSettings').then((m) => ({ default: m.ProjectSettings })))
const AgentCreate = lazy(() => import('./pages/AgentCreate').then((m) => ({ default: m.AgentCreate })))
const TeamList = lazy(() => import('./pages/TeamList').then((m) => ({ default: m.TeamList })))
const TeamEditor = lazy(() => import('./pages/TeamEditor').then((m) => ({ default: m.TeamEditor })))
const SessionPlanner = lazy(() => import('./pages/SessionPlanner').then((m) => ({ default: m.SessionPlanner })))
const SessionWorkspace = lazy(() => import('./pages/SessionWorkspace').then((m) => ({ default: m.SessionWorkspace })))
const MCPServers = lazy(() => import('./pages/MCPServers').then((m) => ({ default: m.MCPServers })))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 size={20} className="animate-spin text-zinc-500" />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<ProjectSettings />} />
            <Route path="/agents" element={<AgentManager />} />
            <Route path="/agents/new" element={<AgentCreate />} />
            <Route path="/agents/:id/edit" element={<AgentCreate />} />
            <Route path="/mcp" element={<MCPServers />} />
            <Route path="/teams" element={<TeamList />} />
            <Route path="/teams/new" element={<TeamEditor />} />
            <Route path="/teams/:id/edit" element={<TeamEditor />} />
            <Route path="/sessions" element={<SessionList />} />
            <Route path="/sessions/:id" element={<SessionPlanner />} />
            <Route path="/workspace/:id" element={<SessionWorkspace />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Suspense>
      </AppShell>
    </BrowserRouter>
  )
}

export default App
