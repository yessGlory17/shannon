package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"agent-workflow/backend/claude"
	"agent-workflow/backend/config"
	"agent-workflow/backend/models"
	"agent-workflow/backend/services"
	"agent-workflow/backend/store"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx context.Context
	cfg *config.Config

	// Stores
	db         *store.DB
	projects   *store.ProjectStore
	agents     *store.AgentStore
	teams      *store.TeamStore
	tasks      *store.TaskStore
	sessions   *store.SessionStore
	mcpServers *store.MCPServerStore

	// Services
	projectMgr     *services.ProjectManager
	runner         *services.AgentRunner
	taskEngine     *services.TaskEngine
	sessionMgr     *services.SessionManager
	diffTracker    *services.DiffTracker
	testRunner     *services.TestRunner
	planner        *services.Planner
	promptImprover *services.PromptImprover
	mcpCatalog     *services.MCPCatalog
	mcpHealth      *services.MCPHealthChecker

	// Secure vault for API keys
	vault *config.SecureVault
}

func NewApp() *App {
	return &App{}
}

func (a *App) shutdown(ctx context.Context) {
	log.Println("Shutting down: stopping all running processes...")

	// Stop all running Claude processes
	if a.runner != nil {
		a.runner.StopAll()
	}

	// Cancel all running sessions
	if a.taskEngine != nil {
		a.taskEngine.StopAllSessions()
	}

	// Close database
	if a.db != nil {
		a.db.Close()
	}

	log.Println("Shutdown complete")
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	cfg, err := config.Load()
	if err != nil {
		log.Printf("config load error: %v, using defaults", err)
		cfg = config.DefaultConfig()
	}
	a.cfg = cfg

	db, err := store.NewDB(cfg.DataDir)
	if err != nil {
		log.Fatalf("database init error: %v", err)
	}
	a.db = db

	// Init stores
	a.projects = store.NewProjectStore(db)
	a.agents = store.NewAgentStore(db)
	a.teams = store.NewTeamStore(db)
	a.tasks = store.NewTaskStore(db)
	a.sessions = store.NewSessionStore(db)
	a.mcpServers = store.NewMCPServerStore(db)

	// Init secure vault for API keys
	vault, err := config.NewSecureVault(cfg.DataDir)
	if err != nil {
		log.Printf("vault init error: %v, starting with empty vault", err)
		vault, _ = config.NewSecureVault(cfg.DataDir)
	}
	a.vault = vault
	envVars := vault.Get()

	// Init services
	a.projectMgr = services.NewProjectManager(cfg.WorkspacePath)
	a.runner = services.NewAgentRunner(cfg.ClaudeCLIPath, envVars)
	a.runner.SetWailsContext(ctx)
	a.diffTracker = services.NewDiffTracker()
	a.testRunner = services.NewTestRunner()
	a.taskEngine = services.NewTaskEngine(a.tasks, a.sessions, a.agents, a.projects, a.mcpServers, a.teams, a.projectMgr, a.runner, a.diffTracker, a.testRunner)
	a.taskEngine.SetWailsContext(ctx)
	a.sessionMgr = services.NewSessionManager(a.sessions, a.tasks, a.projects, a.projectMgr, a.diffTracker)
	a.planner = services.NewPlanner(envVars)
	a.promptImprover = services.NewPromptImprover(envVars)
	a.mcpCatalog = services.NewMCPCatalog()
	a.mcpHealth = services.NewMCPHealthChecker()
}

// ─── Config ────────────────────────────────────────────

func (a *App) GetConfig() *config.Config {
	return a.cfg
}

func (a *App) UpdateConfig(cfg config.Config) error {
	a.cfg = &cfg
	return a.cfg.Save()
}

// ─── Secure Vault (API Keys) ─────────────────────────

// GetEnvVars returns all stored environment variable key-value pairs.
func (a *App) GetEnvVars() map[string]string {
	return a.vault.Get()
}

// UpdateEnvVars replaces all environment variables in the encrypted vault
// and propagates changes to all running services.
func (a *App) UpdateEnvVars(vars map[string]string) error {
	if err := a.vault.Set(vars); err != nil {
		return fmt.Errorf("save vault: %w", err)
	}
	// Propagate to live services
	a.runner.SetEnvVars(vars)
	a.planner.SetEnvVars(vars)
	a.promptImprover.SetEnvVars(vars)
	return nil
}

// ─── Project ───────────────────────────────────────────

func (a *App) ListProjects() ([]models.Project, error) {
	return a.projects.List()
}

func (a *App) ListProjectsPaginated(page, pageSize int) (*models.PaginatedResponse, error) {
	return a.projects.ListPaginated(page, pageSize)
}

func (a *App) CreateProject(p models.Project) (*models.Project, error) {
	if err := a.projects.Create(&p); err != nil {
		return nil, err
	}
	return &p, nil
}

func (a *App) UpdateProject(p models.Project) error {
	return a.projects.Update(&p)
}

func (a *App) DeleteProject(id string) error {
	return a.projects.Delete(id)
}

func (a *App) SelectProjectFolder() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Workspace Folder",
	})
}

// ─── Agent ─────────────────────────────────────────────

func (a *App) ListAgents() ([]models.Agent, error) {
	return a.agents.List()
}

func (a *App) ListAgentsPaginated(page, pageSize int) (*models.PaginatedResponse, error) {
	return a.agents.ListPaginated(page, pageSize)
}

func (a *App) GetAgent(id string) (*models.Agent, error) {
	return a.agents.GetByID(id)
}

func (a *App) CreateAgent(agent models.Agent) (*models.Agent, error) {
	if err := a.agents.Create(&agent); err != nil {
		return nil, err
	}
	return &agent, nil
}

func (a *App) UpdateAgent(agent models.Agent) error {
	return a.agents.Update(&agent)
}

func (a *App) DeleteAgent(id string) error {
	return a.agents.Delete(id)
}

// SeedExampleAgents creates pre-configured complex agents that use
// the currently installed MCP servers. Auto-detects available MCP servers
// and creates specialized agents with full feature usage: disallowed tools,
// protected/read-only paths, retry policies, and detailed system prompts.
func (a *App) SeedExampleAgents() ([]models.Agent, error) {
	servers, err := a.mcpServers.List()
	if err != nil {
		return nil, fmt.Errorf("list MCP servers: %w", err)
	}

	// Build server_key -> ID lookup for enabled servers
	keyToID := make(map[string]string)
	for _, s := range servers {
		if s.Enabled {
			keyToID[s.ServerKey] = s.ID
		}
	}

	// Collect all MCP server IDs
	allIDs := make(models.StringSlice, 0, len(keyToID))
	for _, id := range keyToID {
		allIDs = append(allIDs, id)
	}

	// Helper: resolve MCP keys to IDs, nil means ALL
	resolveMCP := func(keys []string) models.StringSlice {
		if keys == nil {
			return allIDs
		}
		ids := make(models.StringSlice, 0)
		for _, key := range keys {
			if id, ok := keyToID[key]; ok {
				ids = append(ids, id)
			}
		}
		return ids
	}

	// ─── Agent Templates ────────────────────────────────

	type agentTemplate struct {
		Name            string
		Description     string
		Model           string
		SystemPrompt    string
		AllowedTools    models.StringSlice
		DisallowedTools models.StringSlice
		MCPKeys         []string // nil = all MCP servers
		Permissions     string
		ProtectedPaths  models.StringSlice
		ReadOnlyPaths   models.StringSlice
		MaxRetries      int
	}

	templates := []agentTemplate{

		// ── 1. Senior Software Architect ────────────────
		{
			Name:        "Senior Software Architect",
			Description: "Opus-powered architect for complex design decisions, large refactors, and cross-cutting concerns. Has full tool access with safety guardrails on infrastructure files.",
			Model:       "opus",
			SystemPrompt: `<role>
You are a Senior Software Architect with 15+ years of experience across distributed systems, microservices, event-driven architectures, and modern web platforms.
</role>

<instructions>
You are responsible for high-level design decisions, complex refactoring, and ensuring architectural consistency across the codebase.

When given a task:
1. ALWAYS start by understanding the existing architecture — read key files, trace dependencies, and map the module structure before making changes.
2. Design solutions that follow established project patterns. Never introduce a new pattern without documenting why.
3. For refactors: create a migration plan, identify all affected files, and make changes incrementally with verification at each step.
4. For new features: define the data flow, identify integration points, and consider error handling and edge cases upfront.
</instructions>

<principles>
- SOLID principles, but pragmatic — don't over-abstract for hypothetical future needs
- Prefer composition over inheritance
- Keep coupling low: modules should communicate through well-defined interfaces
- Every public API should have clear contracts (input validation, error types, return guarantees)
- Performance matters: avoid O(n²) when O(n) is possible, but don't micro-optimize prematurely
</principles>

<constraints>
- NEVER delete or modify CI/CD configuration files without explicit instruction
- NEVER modify database migration files that have already been applied
- NEVER introduce new external dependencies without documenting the rationale
- If a change affects more than 10 files, break it into smaller PRs/steps
- Always preserve backward compatibility unless explicitly told to break it
</constraints>

<output_format>
When proposing architectural changes:
1. Summary of the current state and identified issues
2. Proposed solution with rationale
3. List of files to create/modify/delete
4. Migration plan if breaking changes are involved
5. Risks and mitigations

When implementing:
- Add brief comments explaining WHY for non-obvious decisions (not WHAT)
- Update relevant documentation if public APIs change
- Run tests after each logical change set
</output_format>`,
			AllowedTools:    models.StringSlice{"Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebFetch", "Task"},
			DisallowedTools: models.StringSlice{"Bash(rm -rf /*)"},
			MCPKeys:         nil,
			Permissions:     "acceptEdits",
			ProtectedPaths:  models.StringSlice{".github/workflows", ".gitlab-ci.yml", "Dockerfile", "docker-compose.yml"},
			ReadOnlyPaths:   models.StringSlice{"CHANGELOG.md", "LICENSE"},
			MaxRetries:      2,
		},

		// ── 2. Security Auditor ─────────────────────────
		{
			Name:        "Security Auditor",
			Description: "Fast security scanning agent using Haiku. Read-only analysis with restricted shell access. Identifies OWASP Top 10, dependency vulnerabilities, secrets exposure, and insecure patterns.",
			Model:       "haiku",
			SystemPrompt: `<role>
You are a Security Auditor specializing in application security, code review, and vulnerability assessment.
</role>

<instructions>
Perform thorough security analysis of the codebase. Your goal is to identify vulnerabilities, insecure patterns, and potential attack vectors.

Audit checklist — scan for ALL of these:

<checklist>
1. **Injection Flaws** (SQL, NoSQL, OS Command, LDAP)
   - String concatenation in queries
   - Unsanitized user input in shell commands
   - Template injection risks

2. **Authentication & Session**
   - Hardcoded credentials or API keys
   - Weak password policies
   - Missing rate limiting on auth endpoints
   - Insecure session management

3. **Sensitive Data Exposure**
   - Secrets in source code (.env files, API keys, tokens)
   - Unencrypted sensitive data in transit or at rest
   - Excessive logging of PII or credentials
   - Missing HTTPS enforcement

4. **Access Control**
   - Missing authorization checks on endpoints
   - IDOR (Insecure Direct Object Reference) patterns
   - Privilege escalation paths
   - Missing CORS configuration

5. **Security Misconfiguration**
   - Debug mode enabled in production configs
   - Default credentials
   - Unnecessary ports/services exposed
   - Missing security headers

6. **Dependency Vulnerabilities**
   - Outdated packages with known CVEs
   - Unmaintained dependencies
   - Supply chain risks

7. **Cryptographic Failures**
   - Weak algorithms (MD5, SHA1 for passwords)
   - Hardcoded encryption keys
   - Missing salt in password hashing

8. **Input Validation**
   - XSS (reflected, stored, DOM-based)
   - Path traversal
   - File upload without validation
   - Missing Content-Type validation
</checklist>
</instructions>

<output_format>
For each finding, report:
- **Severity**: CRITICAL / HIGH / MEDIUM / LOW / INFO
- **Category**: Which OWASP category
- **File:Line**: Exact location
- **Description**: What the vulnerability is
- **Impact**: What an attacker could do
- **Remediation**: Specific fix with code example

Sort findings by severity (CRITICAL first).
End with an executive summary: total findings by severity, overall risk rating, top 3 priorities.
</output_format>

<rules>
- NEVER modify any files — you are read-only
- NEVER execute destructive commands
- Use Bash only for: dependency audit commands (npm audit, pip-audit, govulncheck), git log, file listing
- If you find actual secrets, report the file and line but REDACT the actual secret value
- Focus on real, exploitable issues — minimize false positives
</rules>`,
			AllowedTools:    models.StringSlice{"Read", "Glob", "Grep", "Bash"},
			DisallowedTools: models.StringSlice{"Bash(rm *)", "Bash(mv *)", "Bash(cp *)", "Bash(chmod *)", "Bash(curl * | *)", "Bash(wget *)", "Write(*)", "Edit(*)"},
			MCPKeys:         []string{},
			Permissions:     "default",
			ProtectedPaths:  models.StringSlice{},
			ReadOnlyPaths:   models.StringSlice{},
			MaxRetries:      0,
		},

		// ── 3. Frontend Specialist ──────────────────────
		{
			Name:        "Frontend Specialist",
			Description: "React/TypeScript expert focused on component architecture, state management, responsive UI, accessibility, and performance. Uses WebFetch for documentation lookup.",
			Model:       "sonnet",
			SystemPrompt: `<role>
You are a Senior Frontend Developer specializing in React, TypeScript, and modern web technologies.
</role>

<expertise>
- React 18+ (hooks, suspense, server components, concurrent features)
- TypeScript strict mode with advanced type patterns
- State management (Zustand, Redux Toolkit, React Query, Jotai)
- CSS-in-JS (Tailwind CSS, styled-components) and CSS Modules
- Testing (Vitest, React Testing Library, Playwright for E2E)
- Build tools (Vite, webpack, esbuild, turbopack)
- Accessibility (WCAG 2.1 AA compliance)
- Performance optimization (code splitting, lazy loading, memoization)
</expertise>

<instructions>
When implementing frontend features:

1. **Component Design**
   - Prefer function components with hooks
   - Extract reusable logic into custom hooks
   - Use composition over prop drilling — Context for cross-cutting concerns, props for direct data
   - Keep components focused: if a component does more than one thing, split it
   - Name components descriptively: "UserProfileCard", not "Card"

2. **TypeScript**
   - Define interfaces for all props, state, and API responses
   - Use discriminated unions for complex state
   - Avoid "any" — use "unknown" with type guards when type is uncertain
   - Export types alongside components from the same file

3. **Styling**
   - Follow the project's existing CSS methodology (check for Tailwind, CSS Modules, etc.)
   - Use design tokens / CSS variables for colors, spacing, typography
   - Ensure responsive design: mobile-first approach
   - Dark mode support if the project uses themes

4. **State Management**
   - Keep state as local as possible
   - Use server state libraries (React Query / SWR) for API data
   - Use global stores (Zustand) only for truly global state
   - Avoid derived state in stores — compute it in selectors

5. **Performance**
   - Use React.memo only when profiling shows a bottleneck
   - Use useMemo/useCallback for expensive computations or stable references
   - Implement virtualization for long lists (>100 items)
   - Lazy load routes and heavy components

6. **Testing**
   - Write tests that test behavior, not implementation details
   - Use data-testid attributes for test selectors
   - Test user interactions, not internal state
</instructions>

<constraints>
- NEVER use inline styles except for truly dynamic values (like calculated positions)
- NEVER use var — always const/let
- NEVER mutate state directly — always create new references
- NEVER ignore TypeScript errors with @ts-ignore unless documenting why
- Keep bundle size in mind — prefer tree-shakeable imports
</constraints>`,
			AllowedTools:    models.StringSlice{"Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebFetch"},
			DisallowedTools: models.StringSlice{"Bash(rm -rf *)"},
			MCPKeys:         []string{},
			Permissions:     "acceptEdits",
			ProtectedPaths:  models.StringSlice{"backend/", "*.go", "go.mod", "go.sum"},
			ReadOnlyPaths:   models.StringSlice{"package.json", "tsconfig.json", "vite.config.*"},
			MaxRetries:      2,
		},

		// ── 4. Backend API Engineer ─────────────────────
		{
			Name:        "Backend API Engineer",
			Description: "Backend specialist for Go, Python, and Node.js APIs. Focuses on clean architecture, database design, API contracts, testing, and performance. Test-driven approach with automatic retry.",
			Model:       "sonnet",
			SystemPrompt: `<role>
You are a Senior Backend Engineer specializing in API development, database design, and system integration.
</role>

<expertise>
- Go (stdlib, Gin, Echo, GORM, sqlx)
- Python (FastAPI, Django, SQLAlchemy, Pydantic)
- Node.js (Express, NestJS, Prisma, TypeORM)
- Database design (PostgreSQL, SQLite, Redis, MongoDB)
- API design (REST, GraphQL, gRPC)
- Message queues (RabbitMQ, Kafka, NATS)
- Observability (structured logging, metrics, tracing)
</expertise>

<instructions>
When implementing backend features:

1. **API Design**
   - Follow REST conventions: proper HTTP methods, status codes, resource naming
   - Version APIs from the start (/api/v1/...)
   - Use consistent error response format across all endpoints
   - Document endpoints with OpenAPI/Swagger annotations
   - Implement pagination for list endpoints

2. **Database**
   - Write migrations for schema changes — never alter tables manually
   - Use transactions for multi-step operations
   - Add indices for frequently queried columns
   - Avoid N+1 queries — use eager loading or batch queries
   - Validate data at the application layer AND database level (constraints)

3. **Error Handling**
   - Use typed/sentinel errors — never return generic error strings
   - Log errors with context (request ID, user ID, operation)
   - Never expose internal errors to API consumers
   - Implement circuit breakers for external service calls

4. **Testing (TDD Approach)**
   - Write the test FIRST, then implement
   - Unit tests for business logic (mock external dependencies)
   - Integration tests for API endpoints (use test database)
   - Table-driven tests for functions with multiple cases
   - Test error paths, not just happy paths

5. **Security**
   - Validate and sanitize all input
   - Use parameterized queries — never string concatenation for SQL
   - Implement rate limiting on public endpoints
   - Hash passwords with bcrypt/argon2 — never store plaintext
   - Use short-lived tokens, implement refresh token rotation
</instructions>

<workflow>
For every task:
1. Read existing code to understand patterns and conventions
2. Write failing tests that define the expected behavior
3. Implement the minimum code to pass tests
4. Refactor while keeping tests green
5. Run the full test suite before considering the task complete
6. If tests fail, analyze the error and fix — do not skip
</workflow>

<constraints>
- NEVER commit code without running tests
- NEVER use ORM's raw query mode unless absolutely necessary
- NEVER store secrets in source code
- NEVER return stack traces in API responses
- Always handle context cancellation in long-running operations
</constraints>`,
			AllowedTools:    models.StringSlice{"Bash", "Read", "Write", "Edit", "Glob", "Grep"},
			DisallowedTools: models.StringSlice{"Bash(rm -rf /*)"},
			MCPKeys:         []string{"postgresql", "sqlite", "github", "gitlab"},
			Permissions:     "acceptEdits",
			ProtectedPaths:  models.StringSlice{"frontend/", "*.tsx", "*.jsx", "*.css"},
			ReadOnlyPaths:   models.StringSlice{},
			MaxRetries:      3,
		},

		// ── 5. DevOps & Infrastructure Engineer ─────────
		{
			Name:        "DevOps Engineer",
			Description: "Infrastructure automation specialist. Manages Docker, CI/CD, deployments, monitoring, and cloud configuration. Has full bash access with production-safety guardrails.",
			Model:       "sonnet",
			SystemPrompt: `<role>
You are a Senior DevOps Engineer specializing in infrastructure automation, CI/CD pipelines, containerization, and cloud operations.
</role>

<expertise>
- Containers: Docker, Docker Compose, Podman
- Orchestration: Kubernetes, Helm, Kustomize
- CI/CD: GitHub Actions, GitLab CI, Jenkins
- IaC: Terraform, Ansible, Pulumi
- Cloud: AWS, GCP, Azure
- Monitoring: Prometheus, Grafana, ELK, Datadog
- Security: Trivy, Snyk, SAST/DAST scanning
</expertise>

<instructions>
When working on infrastructure tasks:

1. **Docker**
   - Multi-stage builds to minimize image size
   - Pin base image versions — never use :latest in production
   - Run as non-root user
   - Use .dockerignore to exclude unnecessary files
   - Health checks in every service container

2. **CI/CD Pipelines**
   - Fail fast: run linting and unit tests before expensive builds
   - Cache dependencies between runs
   - Use environment-specific configurations
   - Implement rollback mechanisms
   - Gate deployments with approval for production

3. **Kubernetes**
   - Resource requests and limits for every container
   - Liveness and readiness probes
   - Use namespaces for environment isolation
   - Secrets via external secret managers (not in-cluster secrets)
   - Horizontal Pod Autoscaler for variable workloads

4. **Monitoring & Alerting**
   - Define SLIs/SLOs for critical services
   - Alert on symptoms (error rate, latency), not causes
   - Include runbooks in alert definitions
   - Dashboard for each service: golden signals (latency, traffic, errors, saturation)

5. **Security**
   - Scan images for vulnerabilities in CI
   - Rotate credentials regularly
   - Network policies to restrict pod-to-pod communication
   - Least privilege IAM roles
</instructions>

<constraints>
- NEVER run destructive commands on production resources without confirmation
- NEVER hardcode credentials — use environment variables or secret managers
- NEVER use privileged containers unless absolutely required
- NEVER expose management ports (database, cache) to the internet
- Always test infrastructure changes in a staging environment first
- Use dry-run / plan mode before applying changes (terraform plan, kubectl diff)
</constraints>

<output_format>
For infrastructure changes:
1. What is being changed and why
2. Impact assessment (downtime, resource usage, cost)
3. Rollback plan
4. Verification steps
</output_format>`,
			AllowedTools:    models.StringSlice{"Bash", "Read", "Write", "Edit", "Glob", "Grep"},
			DisallowedTools: models.StringSlice{"Bash(rm -rf /)", "Bash(kubectl delete namespace production*)", "Bash(docker system prune -af)"},
			MCPKeys:         []string{"docker", "kubernetes", "github", "gitlab"},
			Permissions:     "acceptEdits",
			ProtectedPaths:  models.StringSlice{},
			ReadOnlyPaths:   models.StringSlice{"terraform.tfstate", "*.tfstate.backup"},
			MaxRetries:      1,
		},

		// ── 6. Code Reviewer ────────────────────────────
		{
			Name:        "Code Reviewer",
			Description: "Thorough code reviewer using Opus for deep analysis. Read-only agent that produces detailed review reports with severity-rated findings, suggestions, and quality metrics.",
			Model:       "opus",
			SystemPrompt: `<role>
You are a Principal Engineer performing code reviews. You have decades of experience across multiple languages and paradigms.
</role>

<instructions>
Conduct a comprehensive code review of the given code changes or files. Your review must be thorough, actionable, and prioritized.

Review dimensions:

<dimensions>
1. **Correctness**
   - Logic errors, off-by-one, nil/null handling
   - Race conditions in concurrent code
   - Resource leaks (unclosed files, connections, channels)
   - Error handling completeness

2. **Design & Architecture**
   - Single Responsibility Principle adherence
   - Appropriate abstraction level
   - Coupling between modules
   - API design clarity and consistency

3. **Readability & Maintainability**
   - Naming clarity (variables, functions, types)
   - Code organization and file structure
   - Comments where logic is non-obvious
   - Dead code or commented-out blocks

4. **Performance**
   - Unnecessary allocations or copies
   - N+1 queries or excessive I/O
   - Missing caching opportunities
   - Algorithmic complexity concerns

5. **Security**
   - Input validation gaps
   - Injection risks
   - Sensitive data handling
   - Authentication/authorization gaps

6. **Testing**
   - Test coverage for new/changed code
   - Edge case coverage
   - Test readability and maintenance burden
   - Mock vs integration test balance
</dimensions>
</instructions>

<output_format>
Structure your review as:

## Review Summary
One paragraph overview of the changes and overall quality assessment.

## Findings

### 🔴 Critical (Must Fix)
Issues that will cause bugs, security vulnerabilities, or data loss.

### 🟡 Important (Should Fix)
Design issues, maintainability concerns, or performance problems.

### 🔵 Suggestions (Nice to Have)
Style improvements, minor optimizations, or alternative approaches.

### ✅ Positives
What was done well — acknowledge good patterns and decisions.

## Metrics
- Files reviewed: N
- Findings: X critical, Y important, Z suggestions
- Estimated complexity: Low/Medium/High
- Recommendation: Approve / Request Changes / Needs Discussion

For each finding:
- **File:Line** — exact location
- **Issue** — what's wrong
- **Why** — why it matters
- **Fix** — suggested code change (if applicable)
</output_format>

<rules>
- Be constructive, not dismissive
- Focus on substance, not style preferences
- If unsure about a finding, mark it with ⚠️ and explain your uncertainty
- NEVER modify files — you are read-only
- Prioritize: correctness > security > design > performance > style
</rules>`,
			AllowedTools:    models.StringSlice{"Read", "Glob", "Grep", "Bash"},
			DisallowedTools: models.StringSlice{"Write(*)", "Edit(*)", "Bash(rm *)", "Bash(mv *)", "Bash(git push*)", "Bash(git commit*)"},
			MCPKeys:         []string{"github", "gitlab"},
			Permissions:     "default",
			ProtectedPaths:  models.StringSlice{},
			ReadOnlyPaths:   models.StringSlice{},
			MaxRetries:      0,
		},

		// ── 7. Test Engineer ────────────────────────────
		{
			Name:        "Test Engineer",
			Description: "Dedicated test writing and execution agent. Follows TDD methodology, generates comprehensive test suites (unit, integration, E2E), and validates test coverage. Auto-retries on failure.",
			Model:       "sonnet",
			SystemPrompt: `<role>
You are a Test Engineering specialist focused on writing comprehensive, maintainable tests and ensuring high code quality through automated testing.
</role>

<instructions>
Your primary mission is to create and maintain test suites. You follow strict TDD and testing best practices.

<test_strategy>
1. **Unit Tests** (70% of tests)
   - Test individual functions and methods in isolation
   - Mock external dependencies (databases, APIs, file system)
   - Use table-driven tests for functions with multiple input/output cases
   - Cover both happy paths and error paths
   - Test edge cases: empty inputs, nil/null, boundary values, unicode

2. **Integration Tests** (20% of tests)
   - Test module interactions with real (but test-scoped) dependencies
   - Use test databases with proper setup/teardown
   - Test API endpoints end-to-end with HTTP test clients
   - Verify correct database state after operations
   - Test with realistic data volumes (not just single records)

3. **E2E Tests** (10% of tests)
   - Critical user flows only (login, main workflows, payments)
   - Use Playwright MCP if available for browser testing
   - Keep E2E tests stable — avoid flaky selectors
   - Include visual regression testing where applicable
</test_strategy>

<testing_patterns>
**Go:**
- Use testing.T and testify/assert
- Table-driven tests with tt := range tests
- Use t.Parallel() for independent tests
- Cleanup with t.Cleanup()

**TypeScript/JavaScript:**
- Use describe/it/expect (Vitest or Jest)
- React Testing Library for component tests
- Mock modules with vi.mock() / jest.mock()
- Use userEvent over fireEvent for user interactions

**Python:**
- Use pytest with fixtures
- Parametrize with @pytest.mark.parametrize
- Use monkeypatch for mocking
- conftest.py for shared fixtures
</testing_patterns>
</instructions>

<workflow>
1. Read the source code to understand what needs testing
2. Identify all testable behaviors and edge cases
3. Write test file with descriptive test names
4. Run tests to verify they fail (TDD red phase)
5. If implementing code too: write minimum code to pass
6. Run full test suite — ensure no regressions
7. Check coverage and add tests for uncovered paths
</workflow>

<constraints>
- Test names must describe the behavior being tested, not the implementation
  ✅ "returns_error_when_user_not_found"
  ❌ "test_get_user_function"
- NEVER test private/internal implementation details
- NEVER write tests that depend on execution order
- NEVER use time.Sleep for synchronization — use channels, waitgroups, or polling
- Keep test setup DRY with helper functions, but keep assertions in the test body
- Each test must be independent and idempotent
</constraints>`,
			AllowedTools:    models.StringSlice{"Bash", "Read", "Write", "Edit", "Glob", "Grep"},
			DisallowedTools: models.StringSlice{"Bash(rm -rf /*)"},
			MCPKeys:         []string{"playwright-mcp", "playwright"},
			Permissions:     "acceptEdits",
			ProtectedPaths:  models.StringSlice{},
			ReadOnlyPaths:   models.StringSlice{},
			MaxRetries:      3,
		},

		// ── 8. Technical Writer ─────────────────────────
		{
			Name:        "Technical Writer",
			Description: "Documentation specialist using Haiku for fast generation. Creates README files, API docs, architecture guides, inline documentation, and changelogs. Read-only on source code.",
			Model:       "haiku",
			SystemPrompt: `<role>
You are a Technical Writer specializing in developer documentation. You create clear, comprehensive, and well-structured documentation for software projects.
</role>

<instructions>
Create and maintain documentation that helps developers understand, use, and contribute to the project.

<document_types>
1. **README.md**
   - Project overview and purpose (one paragraph)
   - Quick start guide (under 5 minutes to first run)
   - Prerequisites and installation
   - Configuration reference
   - Usage examples with code snippets
   - Contributing guidelines
   - License

2. **API Documentation**
   - Endpoint reference with method, path, parameters
   - Request/response examples (JSON with realistic data)
   - Error codes and their meanings
   - Authentication requirements
   - Rate limiting information

3. **Architecture Guides**
   - System overview diagram (describe in text/mermaid)
   - Component responsibilities
   - Data flow descriptions
   - Decision records (ADRs) for key choices
   - Dependency map

4. **Code Documentation**
   - Package-level documentation
   - Public function/method documentation
   - Complex algorithm explanations
   - Configuration and environment variable reference

5. **Changelogs**
   - Follow Keep a Changelog format
   - Group by: Added, Changed, Deprecated, Removed, Fixed, Security
   - Link to relevant issues/PRs
</document_types>
</instructions>

<writing_principles>
- Write for the reader, not the writer — assume they're new to the project
- Use active voice: "Run the command" not "The command should be run"
- Include code examples for every configuration option
- Keep paragraphs short (3-4 sentences max)
- Use headers, lists, and tables for scannability
- Avoid jargon — if you must use domain terms, define them
- Include both "what" and "why" — not just instructions, but context
</writing_principles>

<constraints>
- NEVER modify source code files — only documentation files (.md, .txt, .rst, docs/)
- NEVER invent features or APIs — only document what actually exists in the code
- Verify code examples by reading the actual source
- Use consistent terminology throughout all documents
- Date all changelogs and architecture decisions
</constraints>`,
			AllowedTools:    models.StringSlice{"Read", "Write", "Edit", "Glob", "Grep", "WebFetch"},
			DisallowedTools: models.StringSlice{"Bash(*)"},
			MCPKeys:         []string{},
			Permissions:     "acceptEdits",
			ProtectedPaths:  models.StringSlice{"*.go", "*.ts", "*.tsx", "*.js", "*.jsx", "*.py", "*.rs", "*.java"},
			ReadOnlyPaths:   models.StringSlice{},
			MaxRetries:      1,
		},

		// ── 9. Database Migration Specialist ─────────────
		{
			Name:        "Database Migration Specialist",
			Description: "Database schema design, migration writing, query optimization, and data modeling specialist. Connects to databases via MCP for live schema inspection. Strict safety on production paths.",
			Model:       "sonnet",
			SystemPrompt: `<role>
You are a Database Engineer specializing in schema design, migrations, query optimization, and data modeling across PostgreSQL, SQLite, and MySQL.
</role>

<instructions>
<schema_design>
- Normalize to 3NF by default, denormalize only with measured performance justification
- Use UUID primary keys for distributed systems, auto-increment for single-node
- Always add created_at, updated_at timestamps
- Use appropriate column types — don't store dates as strings, don't use TEXT for short fixed-length values
- Add CHECK constraints for business rules
- Foreign keys with appropriate ON DELETE behavior (CASCADE, SET NULL, RESTRICT)
- Index strategy: cover all WHERE, JOIN, ORDER BY columns used in queries
</schema_design>

<migrations>
- One migration per logical change — don't combine unrelated schema changes
- Migration files must be idempotent (IF NOT EXISTS, IF EXISTS)
- Always provide both UP and DOWN migrations
- For large tables: use online schema change tools (pt-online-schema-change, pg_repack)
- Never drop columns in the same release — deprecate first, drop in next release
- Test migrations against a copy of production data before applying
</migrations>

<query_optimization>
- Always EXPLAIN ANALYZE before optimizing
- Use covering indices for frequently-run queries
- Avoid SELECT * — list specific columns
- Use CTEs for readability but check if they cause performance issues (PostgreSQL < 12 materializes CTEs)
- Batch INSERT/UPDATE for bulk operations (1000 rows per batch)
- Use connection pooling (PgBouncer, SQLite WAL mode)
- Identify and fix N+1 queries: use JOINs or batch loading
</query_optimization>

<data_integrity>
- Use transactions for multi-statement operations
- Implement optimistic locking where concurrent updates are possible
- Validate data at both application and database layer
- Regular VACUUM and ANALYZE for PostgreSQL
- Use SERIALIZABLE isolation for critical financial operations
</data_integrity>
</instructions>

<constraints>
- NEVER run DROP TABLE or TRUNCATE without explicit confirmation
- NEVER modify migration files that have been applied to any environment
- NEVER store passwords in plaintext — always hash with bcrypt/argon2
- NEVER use dynamic SQL with string concatenation — use parameterized queries
- Always backup before destructive operations
</constraints>`,
			AllowedTools:    models.StringSlice{"Bash", "Read", "Write", "Edit", "Glob", "Grep"},
			DisallowedTools: models.StringSlice{"Bash(DROP DATABASE*)", "Bash(TRUNCATE*)", "Bash(rm -rf /*)"},
			MCPKeys:         []string{"postgresql", "sqlite"},
			Permissions:     "acceptEdits",
			ProtectedPaths:  models.StringSlice{"frontend/", "*.tsx", "*.jsx"},
			ReadOnlyPaths:   models.StringSlice{},
			MaxRetries:      1,
		},

		// ── 10. Rapid Prototyper ────────────────────────
		{
			Name:        "Rapid Prototyper",
			Description: "Fast iteration agent using Haiku for quick prototypes, scripts, and proof-of-concepts. Full tool access with bypass permissions for maximum speed. Disposable output — no production safety needed.",
			Model:       "haiku",
			SystemPrompt: `<role>
You are a Rapid Prototyper — your job is to build things FAST. Working code > perfect code.
</role>

<instructions>
Build prototypes, scripts, and proof-of-concepts as quickly as possible.

Rules of rapid prototyping:
1. Get something working first, optimize later
2. Use the simplest approach that could work
3. Hardcode values if it saves time — document what needs to be made configurable
4. Use existing libraries/tools rather than building from scratch
5. Write just enough error handling to not crash silently
6. Comment TODOs for things that need proper implementation

When given a task:
1. Clarify the core requirement (ignore edge cases for now)
2. Pick the fastest implementation path
3. Build it
4. Verify it works with a quick manual test
5. Document what's prototype-quality vs production-ready
</instructions>

<output_format>
Always end with:
## Prototype Status
- ✅ What works
- ⚠️ Known limitations
- 🔧 What needs to be done for production
</output_format>`,
			AllowedTools:    models.StringSlice{"Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebFetch", "Task", "NotebookEdit"},
			DisallowedTools: models.StringSlice{},
			MCPKeys:         nil,
			Permissions:     "bypassPermissions",
			ProtectedPaths:  models.StringSlice{},
			ReadOnlyPaths:   models.StringSlice{},
			MaxRetries:      1,
		},
	}

	// Create the agents
	var created []models.Agent
	for _, tmpl := range templates {
		agent := models.Agent{
			Name:            tmpl.Name,
			Description:     tmpl.Description,
			Model:           tmpl.Model,
			SystemPrompt:    tmpl.SystemPrompt,
			AllowedTools:    tmpl.AllowedTools,
			DisallowedTools: tmpl.DisallowedTools,
			MCPServerIDs:    resolveMCP(tmpl.MCPKeys),
			Permissions:     tmpl.Permissions,
			ProtectedPaths:  tmpl.ProtectedPaths,
			ReadOnlyPaths:   tmpl.ReadOnlyPaths,
			MaxRetries:      tmpl.MaxRetries,
		}

		if err := a.agents.Create(&agent); err != nil {
			return nil, fmt.Errorf("create agent %q: %w", tmpl.Name, err)
		}
		created = append(created, agent)
	}

	return created, nil
}

// ─── MCP Servers ──────────────────────────────────────

func (a *App) ListMCPServers() ([]models.MCPServer, error) {
	return a.mcpServers.List()
}

func (a *App) GetMCPServer(id string) (*models.MCPServer, error) {
	return a.mcpServers.GetByID(id)
}

func (a *App) CreateMCPServer(server models.MCPServer) (*models.MCPServer, error) {
	if err := a.mcpServers.Create(&server); err != nil {
		return nil, err
	}
	return &server, nil
}

func (a *App) UpdateMCPServer(server models.MCPServer) error {
	return a.mcpServers.Update(&server)
}

func (a *App) DeleteMCPServer(id string) error {
	return a.mcpServers.Delete(id)
}

// ─── MCP Catalog (Smithery Registry) ──────────────────

func (a *App) SearchMCPCatalog(query string, page int) (*services.CatalogResponse, error) {
	return a.mcpCatalog.Search(query, page)
}

func (a *App) GetMCPInstallConfig(qualifiedName string) *services.InstallConfig {
	return a.mcpCatalog.GetInstallConfig(qualifiedName)
}

// ─── MCP Health Check ─────────────────────────────────

func (a *App) TestMCPServer(command string, args []string, env map[string]string) *services.MCPHealthResult {
	return a.mcpHealth.Check(command, args, env)
}

// ─── MCP JSON Import ──────────────────────────────────

func (a *App) ParseMCPJson(jsonStr string) ([]services.MCPJsonImportEntry, error) {
	return a.mcpCatalog.ParseMCPJson(jsonStr)
}

// ─── MCP Import from Claude CLI ──────────────────────

// ImportMCPFromClaude reads ~/.claude.json and collects mcpServers from both
// top-level and per-project scopes, then imports them into the DB.
// Returns the JSON string of the imported servers in .mcp.json format.
func (a *App) ImportMCPFromClaude() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("get home dir: %w", err)
	}

	claudeConfigPath := filepath.Join(home, ".claude.json")
	data, err := os.ReadFile(claudeConfigPath)
	if err != nil {
		return "", fmt.Errorf("read ~/.claude.json: %w", err)
	}

	// Claude Code stores MCP servers in:
	// - Top-level: {"mcpServers": {...}}
	// - Per-project: {"projects": {"/path": {"mcpServers": {...}}}}
	type claudeServerEntry struct {
		Type    string            `json:"type"`
		Command string            `json:"command"`
		Args    []string          `json:"args"`
		Env     map[string]string `json:"env"`
	}

	var claudeConfig struct {
		MCPServers map[string]claudeServerEntry            `json:"mcpServers"`
		Projects   map[string]struct {
			MCPServers map[string]claudeServerEntry `json:"mcpServers"`
		} `json:"projects"`
	}

	if err := json.Unmarshal(data, &claudeConfig); err != nil {
		return "", fmt.Errorf("parse ~/.claude.json: %w", err)
	}

	// Collect all MCP servers: top-level first, then per-project (later entries override)
	type mcpEntry struct {
		Command string            `json:"command"`
		Args    []string          `json:"args,omitempty"`
		Env     map[string]string `json:"env,omitempty"`
	}
	collected := make(map[string]mcpEntry)

	addServers := func(servers map[string]claudeServerEntry) {
		for key, srv := range servers {
			entry := mcpEntry{Command: srv.Command}
			if len(srv.Args) > 0 {
				entry.Args = srv.Args
			}
			if len(srv.Env) > 0 {
				entry.Env = srv.Env
			}
			collected[key] = entry
		}
	}

	// Top-level mcpServers
	addServers(claudeConfig.MCPServers)

	// Per-project mcpServers
	for _, proj := range claudeConfig.Projects {
		addServers(proj.MCPServers)
	}

	if len(collected) == 0 {
		return "", fmt.Errorf("no mcpServers found in ~/.claude.json")
	}

	mcpJson := struct {
		MCPServers map[string]mcpEntry `json:"mcpServers"`
	}{
		MCPServers: collected,
	}

	jsonBytes, err := json.MarshalIndent(mcpJson, "", "  ")
	if err != nil {
		return "", fmt.Errorf("marshal JSON: %w", err)
	}

	// Sync to DB
	jsonStr := string(jsonBytes)
	if err := a.SyncMCPFromJson(jsonStr); err != nil {
		return "", fmt.Errorf("sync to DB: %w", err)
	}

	log.Printf("Imported %d MCP server(s) from ~/.claude.json", len(collected))
	return jsonStr, nil
}

// ─── MCP JSON Sync ───────────────────────────────────

// SyncMCPFromJson takes a .mcp.json format string, parses it, and syncs the DB
// to match. New servers are created, existing ones updated, removed ones deleted.
func (a *App) SyncMCPFromJson(jsonStr string) error {
	entries, err := a.mcpCatalog.ParseMCPJson(jsonStr)
	if err != nil {
		return err
	}

	existing, err := a.mcpServers.List()
	if err != nil {
		return fmt.Errorf("list existing servers: %w", err)
	}

	// Build map of existing servers by server_key
	existingMap := make(map[string]models.MCPServer)
	for _, s := range existing {
		existingMap[s.ServerKey] = s
	}

	// Track which keys are in the new JSON
	newKeys := make(map[string]bool)

	for _, entry := range entries {
		newKeys[entry.ServerKey] = true

		if ex, ok := existingMap[entry.ServerKey]; ok {
			// Update existing
			ex.Command = entry.Command
			ex.Args = entry.Args
			if entry.Env != nil {
				ex.Env = entry.Env
			} else {
				ex.Env = make(map[string]string)
			}
			ex.Enabled = true
			if err := a.mcpServers.Update(&ex); err != nil {
				return fmt.Errorf("update server %s: %w", entry.ServerKey, err)
			}
		} else {
			// Create new
			env := entry.Env
			if env == nil {
				env = make(map[string]string)
			}
			srv := models.MCPServer{
				Name:      entry.ServerKey,
				ServerKey: entry.ServerKey,
				Command:   entry.Command,
				Args:      entry.Args,
				Env:       env,
				Enabled:   true,
			}
			if err := a.mcpServers.Create(&srv); err != nil {
				return fmt.Errorf("create server %s: %w", entry.ServerKey, err)
			}
		}
	}

	// Delete servers that are no longer in the JSON
	for key, ex := range existingMap {
		if !newKeys[key] {
			if err := a.mcpServers.Delete(ex.ID); err != nil {
				return fmt.Errorf("delete server %s: %w", key, err)
			}
		}
	}

	return nil
}

// ExportMCPJson exports all MCP servers from the DB as a .mcp.json format string.
func (a *App) ExportMCPJson() (string, error) {
	servers, err := a.mcpServers.List()
	if err != nil {
		return "", fmt.Errorf("list servers: %w", err)
	}

	type mcpEntry struct {
		Command string            `json:"command"`
		Args    []string          `json:"args"`
		Env     map[string]string `json:"env"`
	}

	mcpConfig := struct {
		MCPServers map[string]mcpEntry `json:"mcpServers"`
	}{
		MCPServers: make(map[string]mcpEntry),
	}

	for _, srv := range servers {
		args := srv.Args
		if args == nil {
			args = []string{}
		}
		env := srv.Env
		if env == nil {
			env = map[string]string{}
		}
		mcpConfig.MCPServers[srv.ServerKey] = mcpEntry{
			Command: srv.Command,
			Args:    args,
			Env:     env,
		}
	}

	data, err := json.MarshalIndent(mcpConfig, "", "  ")
	if err != nil {
		return "", fmt.Errorf("marshal JSON: %w", err)
	}

	return string(data), nil
}

// ─── Team ──────────────────────────────────────────────

func (a *App) ListTeams() ([]models.Team, error) {
	return a.teams.List()
}

func (a *App) ListTeamsPaginated(page, pageSize int) (*models.PaginatedResponse, error) {
	return a.teams.ListPaginated(page, pageSize)
}

func (a *App) GetTeam(id string) (*models.Team, error) {
	return a.teams.GetByID(id)
}

func (a *App) CreateTeam(team models.Team) (*models.Team, error) {
	if err := a.teams.Create(&team); err != nil {
		return nil, err
	}
	return &team, nil
}

func (a *App) UpdateTeam(team models.Team) error {
	return a.teams.Update(&team)
}

func (a *App) DeleteTeam(id string) error {
	return a.teams.Delete(id)
}

// ─── Session ───────────────────────────────────────────

func (a *App) ListSessions() ([]models.Session, error) {
	return a.sessions.List()
}

func (a *App) ListSessionsPaginated(page, pageSize int) (*models.PaginatedResponse, error) {
	return a.sessions.ListPaginated(page, pageSize)
}

func (a *App) GetSession(id string) (*models.Session, error) {
	return a.sessions.GetByID(id)
}

func (a *App) CreateSession(sess models.Session) (*models.Session, error) {
	if err := a.sessions.Create(&sess); err != nil {
		return nil, err
	}
	return &sess, nil
}

func (a *App) ListSessionsByProject(projectID string) ([]models.Session, error) {
	return a.sessions.ListByProject(projectID)
}

func (a *App) DeleteSession(id string) error {
	// Cleanup workspaces when deleting a session
	a.projectMgr.CleanupSession(id)
	return a.sessions.Delete(id)
}

// ─── Task ──────────────────────────────────────────────

func (a *App) ListTasks(sessionID string) ([]models.Task, error) {
	return a.tasks.ListBySession(sessionID)
}

func (a *App) GetTask(id string) (*models.Task, error) {
	return a.tasks.GetByID(id)
}

func (a *App) CreateTask(task models.Task) (*models.Task, error) {
	if err := a.tasks.Create(&task); err != nil {
		return nil, err
	}
	return &task, nil
}

func (a *App) UpdateTask(task models.Task) error {
	return a.tasks.Update(&task)
}

func (a *App) DeleteTask(id string) error {
	return a.tasks.Delete(id)
}

// ─── Execution ─────────────────────────────────────────

func (a *App) StartSession(sessionID string) error {
	return a.taskEngine.StartSession(sessionID)
}

func (a *App) StopSession(sessionID string) error {
	return a.taskEngine.StopSession(sessionID)
}

func (a *App) CompleteSession(sessionID string) error {
	return a.taskEngine.CompleteSession(sessionID)
}

func (a *App) StopTask(taskID string) error {
	return a.runner.StopTask(taskID)
}

func (a *App) GetTaskStreamEvents(taskID string) []claude.TaskStreamEvent {
	return a.runner.GetTaskEvents(taskID)
}

// GetTaskEventCount returns just the count of buffered events (lightweight).
func (a *App) GetTaskEventCount(taskID string) int {
	return a.runner.GetTaskEventCount(taskID)
}

// GetTaskEventRange returns a paginated slice of events (start inclusive, end exclusive).
func (a *App) GetTaskEventRange(taskID string, start, end int) []claude.TaskStreamEvent {
	return a.runner.GetTaskEventRange(taskID, start, end)
}

func (a *App) GetSessionStreamEvents(sessionID string) (map[string][]claude.TaskStreamEvent, error) {
	tasks, err := a.tasks.ListBySession(sessionID)
	if err != nil {
		return nil, err
	}
	taskIDs := make([]string, len(tasks))
	for i, t := range tasks {
		taskIDs[i] = t.ID
	}
	return a.runner.GetSessionEvents(taskIDs), nil
}

func (a *App) ApplyTaskChanges(taskID string) error {
	// No-op: agents work directly on the project directory, changes are already in place.
	return nil
}

func (a *App) RejectTaskChanges(taskID string) error {
	return a.sessionMgr.RejectTaskChanges(taskID)
}

func (a *App) GetTaskDiff(taskID string) (*services.DiffResult, error) {
	task, err := a.tasks.GetByID(taskID)
	if err != nil {
		return nil, err
	}
	projectPath := task.WorkspacePath
	if projectPath == "" {
		return &services.DiffResult{}, nil
	}
	return a.diffTracker.ComputeDiff(projectPath)
}

// ─── Hunk Operations ─────────────────────────────────

// AcceptHunk is a no-op since agents work directly on the project directory.
// Changes are already in place.
func (a *App) AcceptHunk(taskID string, filePath string, hunkIndex int) error {
	return nil
}

// RejectHunk reverts a hunk in the project and optionally sends explanation to Claude.
func (a *App) RejectHunk(taskID string, filePath string, hunkIndex int, reason string) error {
	task, err := a.tasks.GetByID(taskID)
	if err != nil {
		return err
	}
	projectPath := task.WorkspacePath
	if projectPath == "" {
		return fmt.Errorf("task has no workspace")
	}

	diffResult, err := a.diffTracker.ComputeDiff(projectPath)
	if err != nil {
		return err
	}

	var targetHunk *services.DiffHunk
	for _, f := range diffResult.Files {
		if f.Path == filePath && hunkIndex >= 0 && hunkIndex < len(f.Hunks) {
			h := f.Hunks[hunkIndex]
			targetHunk = &h
			break
		}
	}
	if targetHunk == nil {
		return fmt.Errorf("hunk not found")
	}

	if err := a.diffTracker.RevertHunk(projectPath, filePath, *targetHunk); err != nil {
		return fmt.Errorf("revert hunk: %w", err)
	}

	if reason != "" && task.ClaudeSessionID != "" {
		followUpMsg := fmt.Sprintf(
			"The following change in %s was reverted:\n```diff\n%s\n%s\n```\nReason: %s\nPlease adjust your approach accordingly.",
			filePath, targetHunk.Header, targetHunk.Content, reason,
		)
		return a.taskEngine.SendFollowUp(taskID, followUpMsg, "code")
	}

	return nil
}

// AcceptFile is a no-op since agents work directly on the project directory.
// Changes are already in place.
func (a *App) AcceptFile(taskID string, filePath string) error {
	return nil
}

// RejectFile reverts an entire file using git and optionally tells Claude.
func (a *App) RejectFile(taskID string, filePath string, reason string) error {
	task, err := a.tasks.GetByID(taskID)
	if err != nil {
		return err
	}
	projectPath := task.WorkspacePath
	if projectPath == "" {
		return fmt.Errorf("task has no workspace")
	}

	if err := a.diffTracker.RevertFile(projectPath, filePath); err != nil {
		return err
	}

	if reason != "" && task.ClaudeSessionID != "" {
		followUpMsg := fmt.Sprintf(
			"All changes to %s were reverted. Reason: %s\nPlease adjust your approach.",
			filePath, reason,
		)
		return a.taskEngine.SendFollowUp(taskID, followUpMsg, "code")
	}
	return nil
}

// SaveWorkspaceFile saves edited content to a file in the project directory.
func (a *App) SaveWorkspaceFile(taskID string, filePath string, content string) error {
	task, err := a.tasks.GetByID(taskID)
	if err != nil {
		return err
	}
	projectPath := task.WorkspacePath
	if projectPath == "" {
		return fmt.Errorf("task has no workspace")
	}
	fullPath := filepath.Join(projectPath, filePath)
	return os.WriteFile(fullPath, []byte(content), 0644)
}

// ─── CLAUDE.md Memory ────────────────────────────────

func (a *App) GetProjectClaudeMD(projectID string) (string, error) {
	project, err := a.projects.GetByID(projectID)
	if err != nil {
		return "", err
	}
	return project.ClaudeMD, nil
}

func (a *App) UpdateProjectClaudeMD(projectID string, content string) error {
	project, err := a.projects.GetByID(projectID)
	if err != nil {
		return err
	}
	project.ClaudeMD = content
	return a.projects.Update(project)
}

// ─── Retry & Resume ──────────────────────────────────

// RetryTask manually retries a failed task with a fresh session.
func (a *App) RetryTask(taskID string) error {
	task, err := a.tasks.GetByID(taskID)
	if err != nil {
		return err
	}
	if task.Status != models.TaskStatusFailed && task.Status != models.TaskStatusCancelled {
		return fmt.Errorf("can only retry failed or cancelled tasks")
	}

	task.RetryCount++
	task.Status = models.TaskStatusPending
	task.Error = ""
	task.CompletedAt = nil
	task.ClaudeSessionID = "" // fresh session
	// Restore original prompt if available
	if task.OriginalPrompt != "" {
		task.Prompt = task.OriginalPrompt
	}
	return a.tasks.Update(task)
}

// ResumeTask resumes a failed/completed task using --resume with the Claude session.
func (a *App) ResumeTask(taskID string, prompt string) error {
	task, err := a.tasks.GetByID(taskID)
	if err != nil {
		return err
	}

	if task.ClaudeSessionID == "" {
		return fmt.Errorf("task has no claude session to resume — use RetryTask instead")
	}

	task.ResumeCount++
	if err := a.tasks.Update(task); err != nil {
		return err
	}

	return a.taskEngine.SendFollowUp(taskID, prompt, "code")
}

// ─── Follow-up & Chat ────────────────────────────────

func (a *App) SendFollowUp(taskID string, message string, mode string) error {
	return a.taskEngine.SendFollowUp(taskID, message, mode)
}

func (a *App) ReadProjectFile(taskID string, filePath string) (string, error) {
	task, err := a.tasks.GetByID(taskID)
	if err != nil {
		return "", err
	}

	// Use workspace if available, otherwise use project dir
	baseDir := task.WorkspacePath
	if baseDir == "" {
		session, err := a.sessions.GetByID(task.SessionID)
		if err != nil {
			return "", err
		}
		project, err := a.projects.GetByID(session.ProjectID)
		if err != nil {
			return "", err
		}
		baseDir = project.Path
	}

	fullPath := baseDir + "/" + filePath
	data, err := os.ReadFile(fullPath)
	if err != nil {
		return "", fmt.Errorf("read file: %w", err)
	}
	// Limit to 100KB to avoid huge responses
	if len(data) > 100*1024 {
		data = data[:100*1024]
	}
	return string(data), nil
}

func (a *App) ListProjectFiles(taskID string) ([]string, error) {
	task, err := a.tasks.GetByID(taskID)
	if err != nil {
		return nil, err
	}

	baseDir := task.WorkspacePath
	if baseDir == "" {
		session, err := a.sessions.GetByID(task.SessionID)
		if err != nil {
			return nil, err
		}
		project, err := a.projects.GetByID(session.ProjectID)
		if err != nil {
			return nil, err
		}
		baseDir = project.Path
	}

	var files []string
	err = filepath.Walk(baseDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // skip errors
		}
		// Skip hidden dirs and common noise
		name := info.Name()
		if info.IsDir() && (name == ".git" || name == "node_modules" || name == ".next" || name == "__pycache__" || name == "vendor" || name == ".venv") {
			return filepath.SkipDir
		}
		if !info.IsDir() {
			rel, _ := filepath.Rel(baseDir, path)
			files = append(files, rel)
		}
		return nil
	})
	return files, err
}

// ─── Planner ──────────────────────────────────────────

func (a *App) PlanTasks(projectID string, goal string) (*services.PlanResult, error) {
	project, err := a.projects.GetByID(projectID)
	if err != nil {
		return nil, err
	}
	agents, _ := a.agents.List()
	return a.planner.PlanTasks(a.ctx, project.Path, goal, agents)
}

// ─── Prompt Improver ──────────────────────────────────

func (a *App) ImprovePrompt(draft string, agentName string, agentDescription string) (*services.PromptImproveResult, error) {
	return a.promptImprover.ImprovePrompt(a.ctx, draft, agentName, agentDescription)
}

// ─── Workspace Cleanup ────────────────────────────────

func (a *App) CleanupSessionWorkspaces(sessionID string) error {
	return a.projectMgr.CleanupSession(sessionID)
}

func (a *App) CleanupAllWorkspaces() error {
	sessions, err := a.sessions.List()
	if err != nil {
		return err
	}
	for _, sess := range sessions {
		if sess.Status == models.SessionStatusCompleted || sess.Status == models.SessionStatusFailed {
			a.projectMgr.CleanupSession(sess.ID)
		}
	}
	return nil
}

// ─── Stats ─────────────────────────────────────────────

type DashboardStats struct {
	ProjectCount int `json:"project_count"`
	AgentCount   int `json:"agent_count"`
	TeamCount    int `json:"team_count"`
	SessionCount int `json:"session_count"`
	RunningTasks int `json:"running_tasks"`
}

func (a *App) GetDashboardStats() (*DashboardStats, error) {
	var projectCount, agentCount, teamCount, sessionCount int64
	a.db.Model(&models.Project{}).Count(&projectCount)
	a.db.Model(&models.Agent{}).Count(&agentCount)
	a.db.Model(&models.Team{}).Count(&teamCount)
	a.db.Model(&models.Session{}).Count(&sessionCount)

	return &DashboardStats{
		ProjectCount: int(projectCount),
		AgentCount:   int(agentCount),
		TeamCount:    int(teamCount),
		SessionCount: int(sessionCount),
		RunningTasks: a.runner.RunningCount(),
	}, nil
}

// SessionStats returns aggregate statistics for a specific session.
type SessionStats struct {
	TotalTasks     int `json:"total_tasks"`
	CompletedTasks int `json:"completed_tasks"`
	FailedTasks    int `json:"failed_tasks"`
	RunningTasks   int `json:"running_tasks"`
	PendingTasks   int `json:"pending_tasks"`
}

func (a *App) GetSessionStats(sessionID string) (*SessionStats, error) {
	tasks, err := a.tasks.ListBySession(sessionID)
	if err != nil {
		return nil, err
	}

	stats := &SessionStats{}
	for _, t := range tasks {
		stats.TotalTasks++
		switch t.Status {
		case models.TaskStatusCompleted:
			stats.CompletedTasks++
		case models.TaskStatusFailed:
			stats.FailedTasks++
		case models.TaskStatusRunning:
			stats.RunningTasks++
		case models.TaskStatusPending, models.TaskStatusQueued:
			stats.PendingTasks++
		}
	}
	return stats, nil
}

// ─── Dashboard Details (Rich) ─────────────────────────

type StatusCount struct {
	Label string `json:"label"`
	Count int    `json:"count"`
}

type DailyCount struct {
	Date      string `json:"date"`
	Completed int    `json:"completed"`
	Failed    int    `json:"failed"`
}

type AgentPerformance struct {
	AgentID     string  `json:"agent_id"`
	AgentName   string  `json:"agent_name"`
	Model       string  `json:"model"`
	Completed   int     `json:"completed"`
	Failed      int     `json:"failed"`
	Total       int     `json:"total"`
	SuccessRate float64 `json:"success_rate"`
}

type RecentSession struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	ProjectID  string `json:"project_id"`
	Status     string `json:"status"`
	TotalTasks int    `json:"total_tasks"`
	DoneTasks  int    `json:"done_tasks"`
	CreatedAt  string `json:"created_at"`
}

type ActiveTask struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	SessionID string `json:"session_id"`
	AgentID   string `json:"agent_id"`
	AgentName string `json:"agent_name"`
	StartedAt string `json:"started_at"`
}

type CodeReviewStats struct {
	PendingReviews int     `json:"pending_reviews"`
	FilesChanged   int     `json:"files_changed"`
	AcceptedTasks  int     `json:"accepted_tasks"`
	RejectedTasks  int     `json:"rejected_tasks"`
	AcceptRate     float64 `json:"accept_rate"`
}

type TeamActivity struct {
	TeamID     string `json:"team_id"`
	TeamName   string `json:"team_name"`
	Strategy   string `json:"strategy"`
	TaskCount  int    `json:"task_count"`
	AgentCount int    `json:"agent_count"`
}

type ProjectActivity struct {
	ProjectID     string  `json:"project_id"`
	ProjectName   string  `json:"project_name"`
	SessionCount  int     `json:"session_count"`
	TaskCount     int     `json:"task_count"`
	TestPassRate  float64 `json:"test_pass_rate"`
	BuildPassRate float64 `json:"build_pass_rate"`
}

type DashboardDetails struct {
	// Basic counts
	ProjectCount int `json:"project_count"`
	AgentCount   int `json:"agent_count"`
	TeamCount    int `json:"team_count"`
	SessionCount int `json:"session_count"`
	RunningTasks int `json:"running_tasks"`

	// Task & Session distributions
	TaskStatusDist      []StatusCount `json:"task_status_dist"`
	SessionStatusDist   []StatusCount `json:"session_status_dist"`
	TaskSuccessRate     float64       `json:"task_success_rate"`
	TaskCompletionTrend []DailyCount  `json:"task_completion_trend"`

	// Agent performance
	AgentLeaderboard  []AgentPerformance `json:"agent_leaderboard"`
	ModelDistribution []StatusCount      `json:"model_distribution"`

	// Recent activity
	RecentSessions []RecentSession `json:"recent_sessions"`
	ActiveTasks    []ActiveTask    `json:"active_tasks"`

	// Code review
	CodeReview CodeReviewStats `json:"code_review"`

	// Team metrics
	TeamActivities []TeamActivity `json:"team_activities"`
	StrategyDist   []StatusCount  `json:"strategy_dist"`

	// Project stats
	ProjectActivities []ProjectActivity `json:"project_activities"`
}

func (a *App) GetDashboardDetails() (*DashboardDetails, error) {
	d := &DashboardDetails{}

	// ── All basic counts in a single query ──
	type countsResult struct {
		Projects int64
		Agents   int64
		Teams    int64
		Sessions int64
	}
	var counts countsResult
	a.db.Raw(`
		SELECT
			(SELECT COUNT(*) FROM projects) as projects,
			(SELECT COUNT(*) FROM agents) as agents,
			(SELECT COUNT(*) FROM teams) as teams,
			(SELECT COUNT(*) FROM sessions) as sessions
	`).Scan(&counts)
	d.ProjectCount = int(counts.Projects)
	d.AgentCount = int(counts.Agents)
	d.TeamCount = int(counts.Teams)
	d.SessionCount = int(counts.Sessions)
	d.RunningTasks = a.runner.RunningCount()

	// ── Task & Session Status Distribution + Success Rate in one query ──
	type statusRow struct {
		Status string
		Count  int
	}
	var taskStatusRows []statusRow
	a.db.Model(&models.Task{}).
		Select("status, COUNT(*) as count").
		Group("status").
		Scan(&taskStatusRows)

	// Derive success rate directly from the distribution (avoids 2 extra queries)
	var totalCompleted, totalFailed int
	for _, r := range taskStatusRows {
		d.TaskStatusDist = append(d.TaskStatusDist, StatusCount{Label: r.Status, Count: r.Count})
		switch r.Status {
		case "completed":
			totalCompleted = r.Count
		case "failed":
			totalFailed = r.Count
		}
	}
	if totalFinished := totalCompleted + totalFailed; totalFinished > 0 {
		d.TaskSuccessRate = float64(totalCompleted) / float64(totalFinished) * 100
	}

	var sessStatusRows []statusRow
	a.db.Model(&models.Session{}).
		Select("status, COUNT(*) as count").
		Group("status").
		Scan(&sessStatusRows)
	for _, r := range sessStatusRows {
		d.SessionStatusDist = append(d.SessionStatusDist, StatusCount{Label: r.Status, Count: r.Count})
	}

	// ── Task Completion Trend (last 30 days) — uses idx_task_trend_covering ──
	type trendRow struct {
		Day       string
		Completed int
		Failed    int
	}
	var trendRows []trendRow
	a.db.Raw(`
		SELECT DATE(completed_at) as day,
		       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
		       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
		FROM tasks
		WHERE completed_at IS NOT NULL
		  AND completed_at >= DATE('now', '-30 days')
		GROUP BY DATE(completed_at)
		ORDER BY day ASC
	`).Scan(&trendRows)
	for _, r := range trendRows {
		d.TaskCompletionTrend = append(d.TaskCompletionTrend, DailyCount{
			Date: r.Day, Completed: r.Completed, Failed: r.Failed,
		})
	}

	// ── Agent Performance (leaderboard) — uses idx_task_agent_perf ──
	type agentRow struct {
		AgentID   string
		AgentName string
		Model     string
		Completed int
		Failed    int
		Total     int
	}
	var agentRows []agentRow
	a.db.Raw(`
		SELECT t.agent_id,
		       a.name as agent_name,
		       a.model,
		       SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
		       SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed,
		       COUNT(*) as total
		FROM tasks t
		JOIN agents a ON t.agent_id = a.id
		WHERE t.agent_id != ''
		GROUP BY t.agent_id
		ORDER BY completed DESC
		LIMIT 10
	`).Scan(&agentRows)
	for _, r := range agentRows {
		rate := 0.0
		if finished := r.Completed + r.Failed; finished > 0 {
			rate = float64(r.Completed) / float64(finished) * 100
		}
		d.AgentLeaderboard = append(d.AgentLeaderboard, AgentPerformance{
			AgentID: r.AgentID, AgentName: r.AgentName, Model: r.Model,
			Completed: r.Completed, Failed: r.Failed, Total: r.Total,
			SuccessRate: rate,
		})
	}

	// ── Model Distribution ──
	var modelRows []statusRow
	a.db.Model(&models.Agent{}).
		Select("model as status, COUNT(*) as count").
		Group("model").
		Scan(&modelRows)
	for _, r := range modelRows {
		d.ModelDistribution = append(d.ModelDistribution, StatusCount{Label: r.Status, Count: r.Count})
	}

	// ── Recent Sessions with task counts (single query instead of N+1) ──
	type recentSessionRow struct {
		ID         string
		Name       string
		ProjectID  string
		Status     string
		TotalTasks int
		DoneTasks  int
		CreatedAt  string
	}
	var recentRows []recentSessionRow
	a.db.Raw(`
		SELECT s.id, s.name, s.project_id, s.status,
		       COALESCE(tc.total, 0) as total_tasks,
		       COALESCE(tc.done, 0)  as done_tasks,
		       strftime('%Y-%m-%dT%H:%M:%SZ', s.created_at) as created_at
		FROM sessions s
		LEFT JOIN (
			SELECT session_id,
			       COUNT(*) as total,
			       SUM(CASE WHEN status IN ('completed','failed') THEN 1 ELSE 0 END) as done
			FROM tasks
			GROUP BY session_id
		) tc ON tc.session_id = s.id
		ORDER BY s.created_at DESC
		LIMIT 5
	`).Scan(&recentRows)
	for _, r := range recentRows {
		d.RecentSessions = append(d.RecentSessions, RecentSession{
			ID: r.ID, Name: r.Name, ProjectID: r.ProjectID,
			Status: r.Status, TotalTasks: r.TotalTasks, DoneTasks: r.DoneTasks,
			CreatedAt: r.CreatedAt,
		})
	}

	// ── Active Tasks with agent names (single query instead of N+1) ──
	type activeTaskRow struct {
		ID        string
		Title     string
		SessionID string
		AgentID   string
		AgentName string
		StartedAt string
	}
	var activeRows []activeTaskRow
	a.db.Raw(`
		SELECT t.id, t.title, t.session_id, t.agent_id,
		       COALESCE(a.name, '') as agent_name,
		       COALESCE(strftime('%Y-%m-%dT%H:%M:%SZ', t.started_at), '') as started_at
		FROM tasks t
		LEFT JOIN agents a ON t.agent_id = a.id
		WHERE t.status = 'running'
	`).Scan(&activeRows)
	for _, r := range activeRows {
		d.ActiveTasks = append(d.ActiveTasks, ActiveTask{
			ID: r.ID, Title: r.Title, SessionID: r.SessionID,
			AgentID: r.AgentID, AgentName: r.AgentName,
			StartedAt: r.StartedAt,
		})
	}

	// ── Code Review Stats (single query instead of 4 separate queries) ──
	type codeReviewRow struct {
		PendingReviews int
		FilesChanged   int
		Accepted       int
		Rejected       int
	}
	var cr codeReviewRow
	a.db.Raw(`
		SELECT
			(SELECT COUNT(*) FROM tasks
			 WHERE status = 'completed'
			   AND files_changed IS NOT NULL AND files_changed != '' AND files_changed != '[]'
			) as pending_reviews,
			(SELECT COUNT(*) FROM tasks WHERE test_passed = 1) as accepted,
			(SELECT COUNT(*) FROM tasks WHERE test_passed = 0) as rejected
	`).Scan(&cr)
	d.CodeReview.PendingReviews = cr.PendingReviews
	d.CodeReview.AcceptedTasks = cr.Accepted
	d.CodeReview.RejectedTasks = cr.Rejected
	if total := cr.Accepted + cr.Rejected; total > 0 {
		d.CodeReview.AcceptRate = float64(cr.Accepted) / float64(total) * 100
	}

	// Count files changed using SQLite JSON1 extension (avoids loading all rows into memory)
	var filesCount int
	a.db.Raw(`
		SELECT COALESCE(SUM(json_array_length(files_changed)), 0)
		FROM tasks
		WHERE files_changed IS NOT NULL AND files_changed != '' AND files_changed != '[]'
	`).Scan(&filesCount)
	d.CodeReview.FilesChanged = filesCount

	// ── Team Metrics (single query instead of N+1) ──
	var teams []models.Team
	a.db.Find(&teams)

	// Batch: get all team task counts in one query
	type teamTaskCount struct {
		TeamID string
		Count  int
	}
	var teamCounts []teamTaskCount
	a.db.Raw(`
		SELECT team_id, COUNT(*) as count
		FROM tasks
		WHERE team_id != ''
		GROUP BY team_id
	`).Scan(&teamCounts)
	teamCountMap := make(map[string]int, len(teamCounts))
	for _, tc := range teamCounts {
		teamCountMap[tc.TeamID] = tc.Count
	}
	for _, team := range teams {
		d.TeamActivities = append(d.TeamActivities, TeamActivity{
			TeamID: team.ID, TeamName: team.Name,
			Strategy:   string(team.Strategy),
			TaskCount:  teamCountMap[team.ID],
			AgentCount: len(team.AgentIDs),
		})
	}

	// Strategy Distribution
	var stratRows []statusRow
	a.db.Model(&models.Team{}).
		Select("strategy as status, COUNT(*) as count").
		Group("strategy").
		Scan(&stratRows)
	for _, r := range stratRows {
		d.StrategyDist = append(d.StrategyDist, StatusCount{Label: r.Status, Count: r.Count})
	}

	// ── Project Stats (single batch query instead of 5 queries per project) ──
	type projectStatRow struct {
		ProjectID    string
		ProjectName  string
		SessionCount int
		TaskCount    int
		TestTotal    int
		TestPassed   int
		BuildTotal   int
		BuildPassed  int
	}
	var projRows []projectStatRow
	a.db.Raw(`
		SELECT
			p.id as project_id,
			p.name as project_name,
			COALESCE(ps.sess_count, 0) as session_count,
			COALESCE(ps.task_count, 0) as task_count,
			COALESCE(ps.test_total, 0) as test_total,
			COALESCE(ps.test_passed, 0) as test_passed,
			COALESCE(ps.build_total, 0) as build_total,
			COALESCE(ps.build_passed, 0) as build_passed
		FROM projects p
		LEFT JOIN (
			SELECT
				s.project_id,
				COUNT(DISTINCT s.id) as sess_count,
				COUNT(t.id) as task_count,
				SUM(CASE WHEN t.test_passed IS NOT NULL THEN 1 ELSE 0 END) as test_total,
				SUM(CASE WHEN t.test_passed = 1 THEN 1 ELSE 0 END) as test_passed,
				SUM(CASE WHEN t.build_passed IS NOT NULL THEN 1 ELSE 0 END) as build_total,
				SUM(CASE WHEN t.build_passed = 1 THEN 1 ELSE 0 END) as build_passed
			FROM sessions s
			LEFT JOIN tasks t ON t.session_id = s.id
			GROUP BY s.project_id
		) ps ON ps.project_id = p.id
	`).Scan(&projRows)
	for _, r := range projRows {
		testRate, buildRate := 0.0, 0.0
		if r.TestTotal > 0 {
			testRate = float64(r.TestPassed) / float64(r.TestTotal) * 100
		}
		if r.BuildTotal > 0 {
			buildRate = float64(r.BuildPassed) / float64(r.BuildTotal) * 100
		}
		d.ProjectActivities = append(d.ProjectActivities, ProjectActivity{
			ProjectID: r.ProjectID, ProjectName: r.ProjectName,
			SessionCount: r.SessionCount, TaskCount: r.TaskCount,
			TestPassRate: testRate, BuildPassRate: buildRate,
		})
	}

	return d, nil
}
