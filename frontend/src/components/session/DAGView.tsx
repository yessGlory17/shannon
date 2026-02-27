import { useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react'
import dagre from 'dagre'
import '@xyflow/react/dist/style.css'
import { TaskNode } from './TaskNode'
import { TeamGroupNode } from './TeamGroupNode'
import { TeamSubAgentNode } from './TeamSubAgentNode'
import type { Task, Agent, Team } from '../../types'

const nodeTypes: NodeTypes = {
  task: TaskNode,
  teamGroup: TeamGroupNode,
  teamSubAgent: TeamSubAgentNode,
}

const NODE_WIDTH = 200
const NODE_HEIGHT = 70

const SUB_AGENT_W = 160
const SUB_AGENT_H = 50

const GROUP_PAD_X = 24
const GROUP_PAD_TOP = 52
const GROUP_PAD_BOTTOM = 24

function calcGroupSize(team: Team): { width: number; height: number } {
  const n = team.agent_ids.length
  if (n === 0) return { width: NODE_WIDTH, height: NODE_HEIGHT }

  if (team.nodes && team.nodes.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const tn of team.nodes) {
      minX = Math.min(minX, tn.x)
      minY = Math.min(minY, tn.y)
      maxX = Math.max(maxX, tn.x + SUB_AGENT_W)
      maxY = Math.max(maxY, tn.y + SUB_AGENT_H)
    }
    return {
      width: (maxX - minX) + 2 * GROUP_PAD_X,
      height: (maxY - minY) + GROUP_PAD_TOP + GROUP_PAD_BOTTOM,
    }
  }

  return {
    width: GROUP_PAD_X + n * SUB_AGENT_W + (n - 1) * 40 + GROUP_PAD_X,
    height: GROUP_PAD_TOP + SUB_AGENT_H + GROUP_PAD_BOTTOM,
  }
}

function getLayoutedElements(tasks: Task[], agents: Agent[], teams: Team[], selectedTaskId: string | null) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 80 })

  // Build lookup maps to avoid O(n) .find() calls in loops
  const teamMap = new Map(teams.map((t) => [t.id, t]))
  const agentMap = new Map(agents.map((a) => [a.id, a]))
  const taskStatusMap = new Map(tasks.map((t) => [t.id, t.status]))

  const taskTeamMap = new Map<string, Team>()
  for (const task of tasks) {
    if (task.team_id) {
      const team = teamMap.get(task.team_id)
      if (team && team.agent_ids.length > 0) {
        taskTeamMap.set(task.id, team)
      }
    }
  }

  for (const task of tasks) {
    const team = taskTeamMap.get(task.id)
    if (team) {
      const { width, height } = calcGroupSize(team)
      g.setNode(task.id, { width, height })
    } else {
      g.setNode(task.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
    }
  }

  const edges: Edge[] = []
  for (const task of tasks) {
    if (task.dependencies) {
      for (const depId of task.dependencies) {
        edges.push({
          id: `dep-${depId}-${task.id}`,
          source: depId,
          target: task.id,
          animated: taskStatusMap.get(depId) === 'running',
          style: { stroke: '#3f3f46', strokeWidth: 1.5 },
        })
        g.setEdge(depId, task.id)
      }
    }
  }

  dagre.layout(g)

  const nodes: Node[] = []

  for (const task of tasks) {
    const pos = g.node(task.id)
    const team = taskTeamMap.get(task.id)

    if (team) {
      const { width, height } = calcGroupSize(team)

      nodes.push({
        id: task.id,
        type: 'teamGroup',
        position: { x: pos.x - width / 2, y: pos.y - height / 2 },
        style: { width, height },
        data: {
          label: task.title,
          status: task.status,
          teamName: team.name,
          strategy: team.strategy,
          selected: task.id === selectedTaskId,
        },
      })

      if (team.nodes && team.nodes.length > 0) {
        let minX = Infinity, minY = Infinity
        for (const tn of team.nodes) {
          minX = Math.min(minX, tn.x)
          minY = Math.min(minY, tn.y)
        }

        for (const tn of team.nodes) {
          const agent = agentMap.get(tn.agent_id)
          nodes.push({
            id: `${task.id}-agent-${tn.agent_id}`,
            type: 'teamSubAgent',
            position: {
              x: tn.x - minX + GROUP_PAD_X,
              y: tn.y - minY + GROUP_PAD_TOP,
            },
            parentId: task.id,
            extent: 'parent' as const,
            data: {
              label: agent?.name || tn.agent_id.slice(0, 8),
              model: agent?.model || '',
            },
          })
        }
      } else {
        for (let i = 0; i < team.agent_ids.length; i++) {
          const agentId = team.agent_ids[i]
          const agent = agentMap.get(agentId)
          nodes.push({
            id: `${task.id}-agent-${agentId}`,
            type: 'teamSubAgent',
            position: {
              x: GROUP_PAD_X + i * (SUB_AGENT_W + 40),
              y: GROUP_PAD_TOP,
            },
            parentId: task.id,
            extent: 'parent' as const,
            data: {
              label: agent?.name || agentId.slice(0, 8),
              model: agent?.model || '',
            },
          })
        }
      }

      if (team.edges) {
        for (const te of team.edges) {
          edges.push({
            id: `team-${task.id}-${te.source}-${te.target}`,
            source: `${task.id}-agent-${te.source}`,
            target: `${task.id}-agent-${te.target}`,
            style: { stroke: '#3f3f46', strokeWidth: 1.5 },
          })
        }
      }
    } else {
      const getAgentName = () => {
        if (task.agent_id) {
          return agentMap.get(task.agent_id)?.name || task.agent_id.slice(0, 8)
        }
        return 'Unassigned'
      }

      nodes.push({
        id: task.id,
        type: 'task',
        position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
        data: {
          label: task.title,
          status: task.status,
          agentName: getAgentName(),
          selected: task.id === selectedTaskId,
        },
      })
    }
  }

  return { nodes, edges }
}

interface DAGViewProps {
  tasks: Task[]
  agents: Agent[]
  teams: Team[]
  selectedTaskId: string | null
  onSelectTask: (taskId: string) => void
}

export function DAGView({ tasks, agents, teams, selectedTaskId, onSelectTask }: DAGViewProps) {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(tasks, agents, teams, selectedTaskId),
    [tasks, agents, teams, selectedTaskId]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges)

  useEffect(() => {
    setNodes(layoutedNodes)
    setEdges(layoutedEdges)
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges])

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'teamSubAgent') return
      onSelectTask(node.id)
    },
    [onSelectTask]
  )

  if (tasks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
        No tasks to display
      </div>
    )
  }

  return (
    <div className="flex-1 bg-[#111114] rounded-xl border border-white/[0.06] overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        className="bg-[#111114]"
        minZoom={0.3}
        maxZoom={2}
      >
        <Background color="#1f1f23" gap={20} />
        <MiniMap
          nodeColor={(node) => {
            const status = (node.data as any)?.status
            switch (status) {
              case 'running': return '#60a5fa'
              case 'completed': return '#10b981'
              case 'failed': return '#ef4444'
              case 'queued': return '#f59e0b'
              case 'awaiting_input': return '#a855f7'
              default: return '#3f3f46'
            }
          }}
          maskColor="rgba(0,0,0,0.75)"
          className="!bg-[#111114] !border-white/[0.06]"
        />
      </ReactFlow>
    </div>
  )
}
