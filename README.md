<p align="center">
  <img src="build/appicon.png" width="128" height="128" alt="Shannon" />
</p>

<h1 align="center">Shannon</h1>

<p align="center">
  <em>A personal orchestration tool for Claude Code agents</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-CLI-blue?style=flat-square" alt="Claude Code" />
  <img src="https://img.shields.io/badge/Go-1.23-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/React-18.2-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Wails-v2-red?style=flat-square" alt="Wails" />
  <img src="https://img.shields.io/badge/hobby_project-purple?style=flat-square" alt="Hobby Project" />
</p>

---

Shannon is a desktop app that lets you manage **multiple Claude Code instances** working together on your projects. Instead of running one Claude at a time, you create agents with different roles, organize them into teams, and let them tackle tasks in parallel — then review everything before it touches your codebase.

Named after [Claude Shannon](https://en.wikipedia.org/wiki/Claude_Shannon), the father of information theory. The connection felt right.

> **Note:** This is a hobby project. Built for personal use, shared in case others find it useful.

## What it does

**The core loop is simple:** Plan tasks → Assign agents → Execute → Review changes → Apply.

Shannon sits between you and your Claude Code CLI. You define agents with specific system prompts and tool permissions, group them into teams, then point them at your project. Shannon handles the rest — spinning up isolated workspaces, managing execution order, and presenting you with a clean diff review before anything changes.

### Agents & Teams

Create agents with different specializations. A frontend agent, a backend agent, a test writer — each with their own system prompt, model preference, and allowed tools. Then organize them into teams with one of three execution strategies:

- **Parallel** — all agents work simultaneously
- **Sequential** — agents chain one after another
- **Custom** — you draw the execution graph on a visual canvas

### Planning

Describe what you want to accomplish. Shannon uses Claude to break your goal into concrete tasks, figures out dependencies, and assigns them to your agents. You can edit everything before hitting start.

There's also a prompt improver that helps refine agent system prompts — useful when you're not sure how to describe a specialization.

### Execution & Monitoring

Once a session starts, Shannon creates isolated workspace copies of your project for each task. You can watch execution in real-time through a DAG visualization that shows task status, dependencies, and progress. A live chat view streams Claude's output as it works.

### Code Review

This is where Shannon earns its keep. Every change goes through a diff review:

- **Hunk-level** — accept or reject individual code chunks
- **File-level** — approve or reject entire files
- **Feedback loop** — reject with a reason, and Shannon sends your feedback back to Claude for iteration
- **Inline editing** — modify workspace files directly in the built-in Monaco editor

Nothing touches your project until you explicitly approve it.

### MCP Integration

Browse and install MCP servers from the [Smithery](https://smithery.ai/) registry, or configure your own. Attach them to agents to extend their capabilities — web browsing, database access, API integrations, whatever you need.

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop shell | [Wails v2](https://wails.io/) (Go + WebView) |
| Backend | Go 1.23, SQLite (GORM) |
| Frontend | React 18, TypeScript, Tailwind CSS |
| Code editor | Monaco Editor |
| Graph viz | React Flow (XYFlow) + Dagre |
| State | Zustand |
| AI engine | Claude Code CLI |

## Prerequisites

- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- [Wails v2](https://wails.io/docs/gettingstarted/installation) development environment
- Go 1.23+
- Node.js 18+

## Getting Started

```bash
# Clone
git clone https://github.com/yourusername/shannon.git
cd shannon

# Install frontend dependencies
cd frontend && npm install && cd ..

# Run in development mode
wails dev

# Build for production
wails build
```

## Project Structure

```
shannon/
├── backend/
│   ├── claude/        # Claude Code CLI integration
│   ├── config/        # App configuration
│   ├── models/        # Data models (Agent, Team, Session, Task...)
│   ├── services/      # Business logic (TaskEngine, Planner, DiffTracker...)
│   └── store/         # SQLite database operations
├── frontend/
│   ├── src/
│   │   ├── assets/    # Logo, fonts
│   │   ├── components/# Shared UI components
│   │   ├── pages/     # Dashboard, Agents, Teams, Sessions, Workspace...
│   │   ├── stores/    # Zustand state stores
│   │   └── types/     # TypeScript type definitions
│   └── index.html
├── build/             # App icons and build assets
├── app.go             # Wails bindings (all exposed methods)
└── main.go            # Entry point
```

## How it works, roughly

```
You
 │
 ├─ Define agents (system prompt, model, tools, MCP servers)
 ├─ Create a team (parallel / sequential / custom graph)
 ├─ Start a session on a project
 │
 ├─ Shannon plans tasks (or you write them manually)
 ├─ Each task gets an isolated workspace (copy of your project)
 ├─ Claude Code CLI runs in each workspace
 │
 ├─ You review diffs (hunk by hunk or file by file)
 ├─ Reject with feedback → Claude iterates
 └─ Accept → changes applied to your project
```

## Limitations

- Requires Claude Code CLI — this is not a standalone AI tool
- Workspace copies can use significant disk space for large projects
- No remote/cloud mode — it's a local desktop app
- Hobby project — expect rough edges

## License

MIT

---

<p align="center">
  <sub>Built with curiosity and too many Claude API calls.</sub>
</p>
