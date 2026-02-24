export interface Project {
  id: string
  name: string
  path: string
  test_command?: string
  build_command?: string
  setup_command?: string
  created_at: string
  updated_at: string
}

export interface Agent {
  id: string
  name: string
  description: string
  model: string
  system_prompt: string
  allowed_tools: string[]
  mcp_server_ids: string[]
  permissions: string
  created_at: string
  updated_at: string
}

export interface MCPServer {
  id: string
  name: string
  server_key: string
  description: string
  command: string
  args: string[]
  env: Record<string, string>
  enabled: boolean
  created_at: string
  updated_at: string
}

// MCP Catalog (Smithery Registry)
export interface MCPCatalogItem {
  id: string
  qualifiedName: string
  displayName: string
  description: string
  iconUrl: string
  verified: boolean
  useCount: number
  homepage: string
  createdAt: string
  installConfig?: MCPInstallConfig
}

export interface MCPInstallConfig {
  command: string
  args: string[]
  envVars: { name: string; description: string; required: boolean; placeholder?: string }[]
}

export interface MCPCatalogResponse {
  servers: MCPCatalogItem[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export interface TeamNode {
  agent_id: string
  x: number
  y: number
}

export interface TeamEdge {
  source: string
  target: string
}

export interface Team {
  id: string
  name: string
  description: string
  agent_ids: string[]
  strategy: 'parallel' | 'sequential' | 'planner'
  nodes: TeamNode[]
  edges: TeamEdge[]
  created_at: string
  updated_at: string
}

export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type SessionStatus = 'planning' | 'running' | 'paused' | 'completed' | 'failed'

export interface Task {
  id: string
  session_id: string
  title: string
  prompt: string
  status: TaskStatus
  agent_id?: string
  team_id?: string
  dependencies: string[]
  workspace_path?: string
  claude_session_id?: string
  exit_code: number
  result_text?: string
  files_changed: string[]
  test_passed?: boolean
  test_output?: string
  build_passed?: boolean
  build_output?: string
  created_at: string
  started_at?: string
  completed_at?: string
  error?: string
}

export interface Session {
  id: string
  project_id: string
  name: string
  status: SessionStatus
  created_at: string
  started_at?: string
  completed_at?: string
}

export interface DashboardStats {
  project_count: number
  agent_count: number
  team_count: number
  session_count: number
  running_tasks: number
}

export interface SessionStats {
  total_tasks: number
  completed_tasks: number
  failed_tasks: number
  running_tasks: number
  pending_tasks: number
}

// Claude stream events
export interface TaskStreamEvent {
  task_id: string
  type: 'init' | 'text' | 'tool_use' | 'tool_result' | 'result' | 'error' | 'done'
  content: string
  data?: Record<string, any>
}

export interface DiffHunk {
  index: number
  header: string
  old_start: number
  old_count: number
  new_start: number
  new_count: number
  content: string
}

export interface FileDiff {
  path: string
  status: 'added' | 'modified' | 'deleted'
  diff: string
  hunks: DiffHunk[]
}

export interface DiffResult {
  files: FileDiff[]
  total: number
}

export type HunkStatus = 'pending' | 'accepted' | 'rejected'

export interface Config {
  claude_cli_path: string
  workspace_path: string
  data_dir: string
  log_level: string
  theme: string
  language: string
}

// Planner types
export interface ProposedTask {
  title: string
  prompt: string
  dependencies: string[]
  agent_id?: string
  team_id?: string
}

export interface PlanResult {
  tasks: ProposedTask[]
  summary: string
}

// Prompt improver
export interface PromptImproveResult {
  improved_prompt: string
  explanation: string
}

// Project Setup
export interface ProjectType {
  name: string
  indicators: string[]
}

export interface ProjectSetupStatus {
  has_git: boolean
  has_commits: boolean
  has_gitignore: boolean
  current_branch: string
  is_clean_tree: boolean
  untracked_count: number
  uncommitted_count: number
  detected_type: ProjectType
  is_ready: boolean
}

export interface SetupAction {
  init_git: boolean
  create_gitignore: boolean
  initial_commit: boolean
}

export interface SetupStepEvent {
  step: string
  status: string
  message: string
}

// Chat
export type ChatMode = 'code' | 'plan' | 'auto'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  type?: 'text' | 'tool_use' | 'tool_result' | 'result' | 'error' | 'done' | 'init'
  timestamp: number
  attachments?: string[]
}
