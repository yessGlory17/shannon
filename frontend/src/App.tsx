import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { Dashboard } from './pages/Dashboard'
import { ProjectSettings } from './pages/ProjectSettings'
import { AgentManager } from './pages/AgentManager'
import { AgentCreate } from './pages/AgentCreate'
import { TeamList } from './pages/TeamList'
import { TeamEditor } from './pages/TeamEditor'
import { SessionList } from './pages/SessionList'
import { SessionPlanner } from './pages/SessionPlanner'
import { SessionWorkspace } from './pages/SessionWorkspace'
import { MCPServers } from './pages/MCPServers'
import { Settings } from './pages/Settings'

function App() {
  return (
    <BrowserRouter>
      <AppShell>
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
      </AppShell>
    </BrowserRouter>
  )
}

export default App
