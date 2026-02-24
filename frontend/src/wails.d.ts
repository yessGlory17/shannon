import type { Project, Agent, Team, Task, Session, DashboardStats, SessionStats, Config, DiffResult, PlanResult, PromptImproveResult, TaskStreamEvent, ProjectSetupStatus, SetupAction, MCPServer, MCPCatalogResponse, MCPInstallConfig } from './types'

declare global {
  interface Window {
    go: {
      main: {
        App: {
          // Config
          GetConfig(): Promise<Config>
          UpdateConfig(cfg: Config): Promise<void>

          // Projects
          ListProjects(): Promise<Project[]>
          CreateProject(p: Project): Promise<Project>
          UpdateProject(p: Project): Promise<void>
          DeleteProject(id: string): Promise<void>
          SelectProjectFolder(): Promise<string>

          // Project Setup
          CheckProjectSetup(path: string): Promise<ProjectSetupStatus>
          RunProjectSetup(path: string, action: SetupAction): Promise<void>

          // Agents
          ListAgents(): Promise<Agent[]>
          GetAgent(id: string): Promise<Agent>
          CreateAgent(a: Agent): Promise<Agent>
          UpdateAgent(a: Agent): Promise<void>
          DeleteAgent(id: string): Promise<void>

          // MCP Servers
          ListMCPServers(): Promise<MCPServer[]>
          GetMCPServer(id: string): Promise<MCPServer>
          CreateMCPServer(s: MCPServer): Promise<MCPServer>
          UpdateMCPServer(s: MCPServer): Promise<void>
          DeleteMCPServer(id: string): Promise<void>

          // MCP Catalog (Smithery Registry)
          SearchMCPCatalog(query: string, page: number): Promise<MCPCatalogResponse>
          GetMCPInstallConfig(qualifiedName: string): Promise<MCPInstallConfig>

          // Teams
          ListTeams(): Promise<Team[]>
          GetTeam(id: string): Promise<Team>
          CreateTeam(t: Team): Promise<Team>
          UpdateTeam(t: Team): Promise<void>
          DeleteTeam(id: string): Promise<void>

          // Sessions
          ListSessions(): Promise<Session[]>
          GetSession(id: string): Promise<Session>
          CreateSession(s: Session): Promise<Session>
          ListSessionsByProject(projectID: string): Promise<Session[]>
          DeleteSession(id: string): Promise<void>

          // Tasks
          ListTasks(sessionID: string): Promise<Task[]>
          GetTask(id: string): Promise<Task>
          CreateTask(t: Task): Promise<Task>
          UpdateTask(t: Task): Promise<void>
          DeleteTask(id: string): Promise<void>

          // Execution
          StartSession(sessionID: string): Promise<void>
          StopSession(sessionID: string): Promise<void>
          StopTask(taskID: string): Promise<void>
          ApplyTaskChanges(taskID: string): Promise<void>
          RejectTaskChanges(taskID: string): Promise<void>
          GetTaskDiff(taskID: string): Promise<DiffResult>
          GetTaskStreamEvents(taskID: string): Promise<TaskStreamEvent[]>
          GetSessionStreamEvents(sessionID: string): Promise<Record<string, TaskStreamEvent[]>>

          // Hunk Operations
          AcceptHunk(taskID: string, filePath: string, hunkIndex: number): Promise<void>
          RejectHunk(taskID: string, filePath: string, hunkIndex: number, reason: string): Promise<void>
          AcceptFile(taskID: string, filePath: string): Promise<void>
          RejectFile(taskID: string, filePath: string, reason: string): Promise<void>
          SaveWorkspaceFile(taskID: string, filePath: string, content: string): Promise<void>

          // Follow-up & Chat
          SendFollowUp(taskID: string, message: string, mode: string): Promise<void>
          ReadProjectFile(taskID: string, filePath: string): Promise<string>
          ListProjectFiles(taskID: string): Promise<string[]>

          // Planner
          PlanTasks(projectID: string, goal: string): Promise<PlanResult>

          // Prompt Improver
          ImprovePrompt(draft: string, agentName: string, agentDescription: string): Promise<PromptImproveResult>

          // Workspace cleanup
          CleanupSessionWorkspaces(sessionID: string): Promise<void>
          CleanupAllWorkspaces(): Promise<void>

          // Stats
          GetDashboardStats(): Promise<DashboardStats>
          GetSessionStats(sessionID: string): Promise<SessionStats>
        }
      }
    }
    runtime: {
      EventsOn(event: string, callback: (...args: any[]) => void): void
      EventsOff(event: string): void
      EventsEmit(event: string, ...args: any[]): void
    }
  }
}

export {}
