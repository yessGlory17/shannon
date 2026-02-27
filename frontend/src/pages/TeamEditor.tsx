import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, Save, Bot, ChevronDown } from 'lucide-react'
import { useTeamStore } from '../stores/teamStore'
import { useAgentStore } from '../stores/agentStore'
import { TeamAgentNode } from '../components/team/TeamAgentNode'
import type { Agent, Team, TeamNode as TeamNodeType, TeamEdge as TeamEdgeType } from '../types'

const nodeTypes: NodeTypes = {
  agent: TeamAgentNode,
}

type Strategy = 'parallel' | 'sequential' | 'planner'

const strategyOptions: { value: Strategy; label: string; desc: string }[] = [
  { value: 'parallel', label: 'Parallel', desc: 'All agents run at the same time' },
  { value: 'sequential', label: 'Sequential', desc: 'Agents run one after another' },
  { value: 'planner', label: 'Custom', desc: 'Draw connections manually' },
]

export function TeamEditor() {
  const { id: teamId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { teams, fetch: fetchTeams, create, update } = useTeamStore()
  const { agents, fetch: fetchAgents } = useAgentStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [strategy, setStrategy] = useState<Strategy>('parallel')
  const [showStrategyMenu, setShowStrategyMenu] = useState(false)
  const [saving, setSaving] = useState(false)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const nodeCounter = useRef(0)

  const isEdit = !!teamId
  const existingTeam = useMemo(() => teams.find((t) => t.id === teamId), [teams, teamId])

  // Load data
  useEffect(() => {
    fetchTeams()
    fetchAgents()
  }, [fetchTeams, fetchAgents])

  // Load existing team into editor
  useEffect(() => {
    if (!existingTeam) return
    setName(existingTeam.name)
    setDescription(existingTeam.description || '')
    setStrategy(existingTeam.strategy as Strategy)

    // Convert team nodes to reactflow nodes
    if (existingTeam.nodes && existingTeam.nodes.length > 0) {
      const rfNodes: Node[] = existingTeam.nodes.map((tn, i) => {
        const agent = agents.find((a) => a.id === tn.agent_id)
        return {
          id: tn.agent_id,
          type: 'agent',
          position: { x: tn.x, y: tn.y },
          data: {
            label: agent?.name || tn.agent_id.slice(0, 8),
            model: agent?.model || '',
            onDelete: () => removeNode(tn.agent_id),
          },
        }
      })
      setNodes(rfNodes)
      nodeCounter.current = rfNodes.length
    } else if (existingTeam.agent_ids && existingTeam.agent_ids.length > 0) {
      // Legacy: convert agent_ids to nodes
      const rfNodes: Node[] = existingTeam.agent_ids.map((agentId, i) => {
        const agent = agents.find((a) => a.id === agentId)
        return {
          id: agentId,
          type: 'agent',
          position: { x: 100 + i * 250, y: 150 },
          data: {
            label: agent?.name || agentId.slice(0, 8),
            model: agent?.model || '',
            onDelete: () => removeNode(agentId),
          },
        }
      })
      setNodes(rfNodes)
      nodeCounter.current = rfNodes.length
    }

    // Convert team edges to reactflow edges
    if (existingTeam.edges && existingTeam.edges.length > 0) {
      const rfEdges: Edge[] = existingTeam.edges.map((te) => ({
        id: `${te.source}-${te.target}`,
        source: te.source,
        target: te.target,
        style: { stroke: '#3f3f46', strokeWidth: 1.5 },
      }))
      setEdges(rfEdges)
    }
  }, [existingTeam, agents, setNodes, setEdges])

  const removeNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
  }, [setNodes, setEdges])

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          { ...connection, style: { stroke: '#3f3f46', strokeWidth: 1.5 } },
          eds
        )
      )
      // Switch to custom if user draws manually
      setStrategy('planner')
    },
    [setEdges]
  )

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id))
    },
    [setEdges]
  )

  // Agent IDs currently on canvas
  const canvasAgentIds = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes])

  // Available agents (not yet on canvas)
  const availableAgents = useMemo(
    () => agents.filter((a) => !canvasAgentIds.has(a.id)),
    [agents, canvasAgentIds]
  )

  // Add agent to canvas
  const addAgentToCanvas = (agent: Agent) => {
    const x = 100 + (nodeCounter.current % 4) * 250
    const y = 100 + Math.floor(nodeCounter.current / 4) * 120
    nodeCounter.current++

    const newNode: Node = {
      id: agent.id,
      type: 'agent',
      position: { x, y },
      data: {
        label: agent.name,
        model: agent.model,
        onDelete: () => removeNode(agent.id),
      },
    }
    setNodes((nds) => [...nds, newNode])
  }

  // Apply strategy preset
  const applyStrategy = (strat: Strategy) => {
    setStrategy(strat)
    setShowStrategyMenu(false)

    if (strat === 'parallel') {
      // Clear edges, position in a row
      setEdges([])
      setNodes((nds) =>
        nds.map((n, i) => ({
          ...n,
          position: { x: 100 + i * 250, y: 150 },
        }))
      )
    } else if (strat === 'sequential') {
      // Chain nodes left to right
      setNodes((nds) => {
        const ordered = [...nds].map((n, i) => ({
          ...n,
          position: { x: 100 + i * 250, y: 150 },
        }))

        // Create chain edges
        const chainEdges: Edge[] = []
        for (let i = 0; i < ordered.length - 1; i++) {
          chainEdges.push({
            id: `${ordered[i].id}-${ordered[i + 1].id}`,
            source: ordered[i].id,
            target: ordered[i + 1].id,
            style: { stroke: '#3f3f46', strokeWidth: 1.5 },
          })
        }
        setEdges(chainEdges)
        return ordered
      })
    }
    // 'planner' (custom) = no changes
  }

  // Handle drag from sidebar
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const agentId = e.dataTransfer.getData('application/agentId')
      if (!agentId) return

      const agent = agents.find((a) => a.id === agentId)
      if (!agent || canvasAgentIds.has(agentId)) return

      const bounds = reactFlowWrapper.current?.getBoundingClientRect()
      const x = bounds ? e.clientX - bounds.left : 200
      const y = bounds ? e.clientY - bounds.top : 200
      nodeCounter.current++

      const newNode: Node = {
        id: agent.id,
        type: 'agent',
        position: { x: x - 80, y: y - 30 },
        data: {
          label: agent.name,
          model: agent.model,
          onDelete: () => removeNode(agent.id),
        },
      }
      setNodes((nds) => [...nds, newNode])
    },
    [agents, canvasAgentIds, setNodes, removeNode]
  )

  // Save
  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const teamNodes: TeamNodeType[] = nodes.map((n) => ({
        agent_id: n.id,
        x: n.position.x,
        y: n.position.y,
      }))

      const teamEdges: TeamEdgeType[] = edges.map((e) => ({
        source: e.source,
        target: e.target,
      }))

      const agentIds = nodes.map((n) => n.id)

      const teamData: Partial<Team> = {
        name: name.trim(),
        description: description.trim(),
        strategy,
        agent_ids: agentIds,
        nodes: teamNodes,
        edges: teamEdges,
      }

      if (isEdit && existingTeam) {
        await update({ ...existingTeam, ...teamData } as Team)
      } else {
        await create(teamData)
      }
      navigate('/teams')
    } catch (e) {
      console.error('Save failed:', e)
    } finally {
      setSaving(false)
    }
  }

  const currentStrategy = strategyOptions.find((s) => s.value === strategy) || strategyOptions[0]

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/teams')}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Team name"
            className="text-lg font-bold font-display text-zinc-100 bg-transparent border-b border-transparent hover:border-white/[0.08] focus:border-brand-blue/50 focus:outline-none px-1 py-0.5 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Strategy dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowStrategyMenu(!showStrategyMenu)}
              className="flex items-center gap-2 px-3 py-2 bg-white/[0.06] hover:bg-white/[0.10] text-zinc-200 text-sm rounded-lg transition-colors"
            >
              {currentStrategy.label}
              <ChevronDown size={14} className="text-zinc-500" />
            </button>
            {showStrategyMenu && (
              <div className="absolute right-0 top-full mt-1 bg-[#111114] border border-white/[0.08] rounded-xl overflow-hidden shadow-brand-lg z-20 min-w-[200px]">
                {strategyOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => applyStrategy(opt.value)}
                    className={`w-full flex flex-col items-start px-3 py-2 hover:bg-white/[0.06] text-left transition-colors ${
                      strategy === opt.value ? 'bg-white/[0.04]' : ''
                    }`}
                  >
                    <span className="text-sm text-zinc-200">{opt.label}</span>
                    <span className="text-[10px] text-zinc-500">{opt.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="flex items-center gap-2 px-4 py-2 bg-brand-gradient hover:opacity-90 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-brand-sm"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main: sidebar + canvas */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Agent sidebar */}
        <div className="w-48 flex-shrink-0 rounded-xl bg-[#111114] border border-white/[0.06] overflow-auto">
          <div className="p-3 border-b border-white/[0.06]">
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Agents</h2>
            <p className="text-[10px] text-zinc-600 mt-0.5">Drag onto canvas</p>
          </div>
          <div className="p-2 space-y-1">
            {agents.length === 0 ? (
              <p className="text-xs text-zinc-600 px-2 py-4 text-center">
                No agents created yet
              </p>
            ) : (
              agents.map((agent) => {
                const onCanvas = canvasAgentIds.has(agent.id)
                return (
                  <div
                    key={agent.id}
                    draggable={!onCanvas}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/agentId', agent.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onClick={() => !onCanvas && addAgentToCanvas(agent)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                      onCanvas
                        ? 'bg-white/[0.03] text-zinc-600 cursor-default'
                        : 'bg-white/[0.06] text-zinc-300 hover:bg-white/[0.10] cursor-grab active:cursor-grabbing'
                    }`}
                  >
                    <Bot size={12} className={onCanvas ? 'text-zinc-700' : 'text-brand-blue'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{agent.name}</p>
                      <p className="text-[10px] text-zinc-600">{agent.model}</p>
                    </div>
                    {onCanvas && <span className="text-[9px] text-zinc-600">added</span>}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={reactFlowWrapper}
          className="flex-1 rounded-xl bg-[#111114] border border-white/[0.06] overflow-hidden"
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.4 }}
            proOptions={{ hideAttribution: true }}
            className="bg-[#111114]"
            minZoom={0.3}
            maxZoom={2}
            defaultEdgeOptions={{ style: { stroke: '#3f3f46', strokeWidth: 1.5 } }}
          >
            <Background color="#1f1f23" gap={20} />
          </ReactFlow>
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-zinc-600">
                Drag agents from the sidebar or click to add them
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="mt-3 flex-shrink-0">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Team description (optional)"
          className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-zinc-300 placeholder:text-zinc-600 input-focus transition-colors"
        />
      </div>
    </div>
  )
}
