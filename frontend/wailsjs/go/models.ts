export namespace claude {
	
	export class TaskStreamEvent {
	    task_id: string;
	    type: string;
	    content: string;
	    data?: any;
	
	    static createFrom(source: any = {}) {
	        return new TaskStreamEvent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.task_id = source["task_id"];
	        this.type = source["type"];
	        this.content = source["content"];
	        this.data = source["data"];
	    }
	}

}

export namespace config {
	
	export class Config {
	    claude_cli_path: string;
	    workspace_path: string;
	    data_dir: string;
	    log_level: string;
	    theme: string;
	    language: string;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.claude_cli_path = source["claude_cli_path"];
	        this.workspace_path = source["workspace_path"];
	        this.data_dir = source["data_dir"];
	        this.log_level = source["log_level"];
	        this.theme = source["theme"];
	        this.language = source["language"];
	    }
	}

}

export namespace main {
	
	export class DashboardStats {
	    project_count: number;
	    agent_count: number;
	    team_count: number;
	    session_count: number;
	    running_tasks: number;
	
	    static createFrom(source: any = {}) {
	        return new DashboardStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.project_count = source["project_count"];
	        this.agent_count = source["agent_count"];
	        this.team_count = source["team_count"];
	        this.session_count = source["session_count"];
	        this.running_tasks = source["running_tasks"];
	    }
	}
	export class SessionStats {
	    total_tasks: number;
	    completed_tasks: number;
	    failed_tasks: number;
	    running_tasks: number;
	    pending_tasks: number;
	
	    static createFrom(source: any = {}) {
	        return new SessionStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total_tasks = source["total_tasks"];
	        this.completed_tasks = source["completed_tasks"];
	        this.failed_tasks = source["failed_tasks"];
	        this.running_tasks = source["running_tasks"];
	        this.pending_tasks = source["pending_tasks"];
	    }
	}

}

export namespace models {
	
	export class Agent {
	    id: string;
	    name: string;
	    description: string;
	    model: string;
	    system_prompt: string;
	    allowed_tools: string[];
	    mcp_server_ids: string[];
	    permissions: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Agent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.model = source["model"];
	        this.system_prompt = source["system_prompt"];
	        this.allowed_tools = source["allowed_tools"];
	        this.mcp_server_ids = source["mcp_server_ids"];
	        this.permissions = source["permissions"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class MCPServer {
	    id: string;
	    name: string;
	    server_key: string;
	    description: string;
	    command: string;
	    args: string[];
	    env: Record<string, string>;
	    enabled: boolean;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new MCPServer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.server_key = source["server_key"];
	        this.description = source["description"];
	        this.command = source["command"];
	        this.args = source["args"];
	        this.env = source["env"];
	        this.enabled = source["enabled"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Project {
	    id: string;
	    name: string;
	    path: string;
	    test_command?: string;
	    build_command?: string;
	    setup_commands: string[];
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.path = source["path"];
	        this.test_command = source["test_command"];
	        this.build_command = source["build_command"];
	        this.setup_commands = source["setup_commands"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Session {
	    id: string;
	    project_id: string;
	    name: string;
	    status: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    started_at?: any;
	    // Go type: time
	    completed_at?: any;
	
	    static createFrom(source: any = {}) {
	        return new Session(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.project_id = source["project_id"];
	        this.name = source["name"];
	        this.status = source["status"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.started_at = this.convertValues(source["started_at"], null);
	        this.completed_at = this.convertValues(source["completed_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Task {
	    id: string;
	    session_id: string;
	    title: string;
	    prompt: string;
	    status: string;
	    agent_id?: string;
	    team_id?: string;
	    dependencies: string[];
	    workspace_path?: string;
	    claude_session_id?: string;
	    exit_code: number;
	    result_text?: string;
	    files_changed: string[];
	    pending_input_data?: string;
	    test_passed?: boolean;
	    test_output?: string;
	    build_passed?: boolean;
	    build_output?: string;
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    started_at?: any;
	    // Go type: time
	    completed_at?: any;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new Task(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.session_id = source["session_id"];
	        this.title = source["title"];
	        this.prompt = source["prompt"];
	        this.status = source["status"];
	        this.agent_id = source["agent_id"];
	        this.team_id = source["team_id"];
	        this.dependencies = source["dependencies"];
	        this.workspace_path = source["workspace_path"];
	        this.claude_session_id = source["claude_session_id"];
	        this.exit_code = source["exit_code"];
	        this.result_text = source["result_text"];
	        this.files_changed = source["files_changed"];
	        this.pending_input_data = source["pending_input_data"];
	        this.test_passed = source["test_passed"];
	        this.test_output = source["test_output"];
	        this.build_passed = source["build_passed"];
	        this.build_output = source["build_output"];
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.started_at = this.convertValues(source["started_at"], null);
	        this.completed_at = this.convertValues(source["completed_at"], null);
	        this.error = source["error"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TeamEdge {
	    source: string;
	    target: string;
	
	    static createFrom(source: any = {}) {
	        return new TeamEdge(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.source = source["source"];
	        this.target = source["target"];
	    }
	}
	export class TeamNode {
	    agent_id: string;
	    x: number;
	    y: number;
	
	    static createFrom(source: any = {}) {
	        return new TeamNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.agent_id = source["agent_id"];
	        this.x = source["x"];
	        this.y = source["y"];
	    }
	}
	export class Team {
	    id: string;
	    name: string;
	    description: string;
	    agent_ids: string[];
	    strategy: string;
	    nodes: TeamNode[];
	    edges: TeamEdge[];
	    // Go type: time
	    created_at: any;
	    // Go type: time
	    updated_at: any;
	
	    static createFrom(source: any = {}) {
	        return new Team(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.agent_ids = source["agent_ids"];
	        this.strategy = source["strategy"];
	        this.nodes = this.convertValues(source["nodes"], TeamNode);
	        this.edges = this.convertValues(source["edges"], TeamEdge);
	        this.created_at = this.convertValues(source["created_at"], null);
	        this.updated_at = this.convertValues(source["updated_at"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	

}

export namespace services {
	
	export class EnvVarDef {
	    name: string;
	    description: string;
	    required: boolean;
	    placeholder?: string;
	
	    static createFrom(source: any = {}) {
	        return new EnvVarDef(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	        this.required = source["required"];
	        this.placeholder = source["placeholder"];
	    }
	}
	export class InstallConfig {
	    command: string;
	    args: string[];
	    envVars: EnvVarDef[];
	    docUrl?: string;
	
	    static createFrom(source: any = {}) {
	        return new InstallConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.command = source["command"];
	        this.args = source["args"];
	        this.envVars = this.convertValues(source["envVars"], EnvVarDef);
	        this.docUrl = source["docUrl"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CatalogItem {
	    id: string;
	    qualifiedName: string;
	    displayName: string;
	    description: string;
	    iconUrl: string;
	    verified: boolean;
	    useCount: number;
	    homepage: string;
	    createdAt: string;
	    installConfig?: InstallConfig;
	
	    static createFrom(source: any = {}) {
	        return new CatalogItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.qualifiedName = source["qualifiedName"];
	        this.displayName = source["displayName"];
	        this.description = source["description"];
	        this.iconUrl = source["iconUrl"];
	        this.verified = source["verified"];
	        this.useCount = source["useCount"];
	        this.homepage = source["homepage"];
	        this.createdAt = source["createdAt"];
	        this.installConfig = this.convertValues(source["installConfig"], InstallConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CatalogResponse {
	    servers: CatalogItem[];
	    totalCount: number;
	    page: number;
	    pageSize: number;
	    totalPages: number;
	
	    static createFrom(source: any = {}) {
	        return new CatalogResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.servers = this.convertValues(source["servers"], CatalogItem);
	        this.totalCount = source["totalCount"];
	        this.page = source["page"];
	        this.pageSize = source["pageSize"];
	        this.totalPages = source["totalPages"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DiffHunk {
	    index: number;
	    header: string;
	    old_start: number;
	    old_count: number;
	    new_start: number;
	    new_count: number;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new DiffHunk(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.index = source["index"];
	        this.header = source["header"];
	        this.old_start = source["old_start"];
	        this.old_count = source["old_count"];
	        this.new_start = source["new_start"];
	        this.new_count = source["new_count"];
	        this.content = source["content"];
	    }
	}
	export class FileDiff {
	    path: string;
	    status: string;
	    diff: string;
	    hunks: DiffHunk[];
	
	    static createFrom(source: any = {}) {
	        return new FileDiff(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.status = source["status"];
	        this.diff = source["diff"];
	        this.hunks = this.convertValues(source["hunks"], DiffHunk);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DiffResult {
	    files: FileDiff[];
	    total: number;
	
	    static createFrom(source: any = {}) {
	        return new DiffResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.files = this.convertValues(source["files"], FileDiff);
	        this.total = source["total"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	export class MCPHealthResult {
	    success: boolean;
	    serverName?: string;
	    version?: string;
	    capabilities?: string[];
	    error?: string;
	    durationMs: number;
	
	    static createFrom(source: any = {}) {
	        return new MCPHealthResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.serverName = source["serverName"];
	        this.version = source["version"];
	        this.capabilities = source["capabilities"];
	        this.error = source["error"];
	        this.durationMs = source["durationMs"];
	    }
	}
	export class MCPJsonImportEntry {
	    serverKey: string;
	    command: string;
	    args: string[];
	    env: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new MCPJsonImportEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.serverKey = source["serverKey"];
	        this.command = source["command"];
	        this.args = source["args"];
	        this.env = source["env"];
	    }
	}
	export class ProposedTask {
	    title: string;
	    prompt: string;
	    dependencies: string[];
	    agent_id?: string;
	
	    static createFrom(source: any = {}) {
	        return new ProposedTask(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.prompt = source["prompt"];
	        this.dependencies = source["dependencies"];
	        this.agent_id = source["agent_id"];
	    }
	}
	export class PlanResult {
	    tasks: ProposedTask[];
	    summary: string;
	
	    static createFrom(source: any = {}) {
	        return new PlanResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tasks = this.convertValues(source["tasks"], ProposedTask);
	        this.summary = source["summary"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PromptImproveResult {
	    improved_prompt: string;
	    explanation: string;
	
	    static createFrom(source: any = {}) {
	        return new PromptImproveResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.improved_prompt = source["improved_prompt"];
	        this.explanation = source["explanation"];
	    }
	}

}

