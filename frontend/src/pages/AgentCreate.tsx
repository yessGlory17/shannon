import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAgentStore } from '../stores/agentStore'
import { AgentFormStepper, type AgentFormData } from '../components/agents/AgentFormStepper'
import type { Agent } from '../types'

const DEFAULT_FORM: AgentFormData = {
  name: '',
  description: '',
  model: 'sonnet',
  system_prompt: '',
  allowed_tools: ['Bash', 'Read', 'Write', 'Edit'],
  mcp_server_ids: [],
  permissions: 'acceptEdits',
}

export function AgentCreate() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { agents, fetch, create, update } = useAgentStore()
  const [formData, setFormData] = useState<AgentFormData>(DEFAULT_FORM)
  const isEditing = !!id

  useEffect(() => {
    fetch()
  }, [fetch])

  useEffect(() => {
    if (id && agents.length > 0) {
      const agent = agents.find((a) => a.id === id)
      if (agent) {
        setFormData({
          name: agent.name,
          description: agent.description,
          model: agent.model,
          system_prompt: agent.system_prompt,
          allowed_tools: agent.allowed_tools || [],
          mcp_server_ids: agent.mcp_server_ids || [],
          permissions: agent.permissions,
        })
      }
    }
  }, [id, agents])

  const handleSave = async (data: AgentFormData) => {
    if (isEditing) {
      await update({ ...data, id } as Agent)
    } else {
      await create(data as Partial<Agent>)
    }
    navigate('/agents')
  }

  const handleCancel = () => {
    navigate('/agents')
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate('/agents')}
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            {isEditing ? 'Edit Agent' : 'New Agent'}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isEditing ? 'Modify agent configuration' : 'Configure a new AI agent step by step'}
          </p>
        </div>
      </div>

      {/* Stepper fills remaining space */}
      <div className="flex-1 min-h-0">
        <AgentFormStepper
          initialData={formData}
          isEditing={isEditing}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
