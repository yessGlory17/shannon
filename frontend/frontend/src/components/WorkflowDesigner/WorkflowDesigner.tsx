import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Save as SaveIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  FolderOpen as OpenIcon,
} from '@mui/icons-material';
import { Node, Edge } from 'reactflow';
import { NodePalette } from './NodePalette';
import { WorkflowCanvas } from './WorkflowCanvas';
import { NodeConfigPanel } from './NodeConfigPanel';
import { ExecutionOverlay } from './ExecutionOverlay';
import { useWorkflowExecution } from '../../hooks/useWorkflowExecution';

interface WorkflowDesignerProps {
  workflowId?: string;
}

export const WorkflowDesigner: React.FC<WorkflowDesignerProps> = ({ workflowId }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(workflowId || null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [skills, setSkills] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);

  const { executionState, isExecuting, error, startExecution } =
    useWorkflowExecution(currentWorkflowId);

  // Load skills and agents on mount
  useEffect(() => {
    loadSkills();
    loadAgents();
  }, []);

  // Load workflow if workflowId is provided
  useEffect(() => {
    if (workflowId) {
      loadWorkflow(workflowId);
    }
  }, [workflowId]);

  const loadSkills = async () => {
    try {
      if (window.go?.main?.App) {
        const skillsList = await (window as any).go.main.App.ListSkills();
        setSkills(skillsList || []);
      }
    } catch (err) {
      console.error('Failed to load skills:', err);
    }
  };

  const loadAgents = async () => {
    try {
      if (window.go?.main?.App) {
        const agentsList = await (window as any).go.main.App.ListAgents();
        setAgents(agentsList || []);
      }
    } catch (err) {
      console.error('Failed to load agents:', err);
    }
  };

  const loadWorkflow = async (id: string) => {
    try {
      if (window.go?.main?.App) {
        const workflow = await (window as any).go.main.App.LoadWorkflow(id);
        if (workflow) {
          setWorkflowName(workflow.name);
          setWorkflowDescription(workflow.description || '');
          setCurrentWorkflowId(workflow.id);

          // Convert tasks to nodes
          const loadedNodes: Node[] = (workflow.tasks || []).map((task: any) => ({
            id: task.id,
            type: 'task',
            position: { x: task.position_x || 0, y: task.position_y || 0 },
            data: {
              label: task.name,
              description: task.description,
              skill: task.skill,
              model: task.model || 'sonnet',
              priority: task.priority || 0,
              status: task.status || 'pending',
              outputPath: task.output_path,
            },
          }));

          // Convert dependencies to edges
          const loadedEdges: Edge[] = [];
          (workflow.tasks || []).forEach((task: any) => {
            (task.dependencies || []).forEach((depId: string) => {
              loadedEdges.push({
                id: \`\${depId}-\${task.id}\`,
                source: depId,
                target: task.id,
                type: 'smoothstep',
                animated: true,
              });
            });
          });

          setNodes(loadedNodes);
          setEdges(loadedEdges);
        }
      }
    } catch (err) {
      console.error('Failed to load workflow:', err);
    }
  };

  const handleSave = async () => {
    if (!workflowName.trim()) {
      setSaveDialogOpen(true);
      return;
    }

    setIsSaving(true);

    try {
      // Convert nodes to tasks
      const tasks = nodes.map((node) => {
        // Find dependencies from edges
        const dependencies = edges
          .filter((edge) => edge.target === node.id)
          .map((edge) => edge.source);

        return {
          id: node.id,
          name: node.data.label || 'Untitled Task',
          description: node.data.description || '',
          status: 'pending',
          priority: node.data.priority || 0,
          skill: node.data.skill || '',
          model: node.data.model || 'sonnet',
          output_path: node.data.outputPath || '',
          position_x: node.position.x,
          position_y: node.position.y,
          dependencies,
          context: {},
          variables: {},
          created_at: new Date().toISOString(),
        };
      });

      const workflow = {
        id: currentWorkflowId || \`workflow-\${Date.now()}\`,
        name: workflowName,
        description: workflowDescription,
        tasks,
        status: 'pending',
        created_at: new Date().toISOString(),
        version: 1,
      };

      if (window.go?.main?.App) {
        await (window as any).go.main.App.SaveWorkflow(workflow);
        setCurrentWorkflowId(workflow.id);
        console.log('Workflow saved successfully');
      }
    } catch (err) {
      console.error('Failed to save workflow:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRun = async () => {
    // Save before running
    if (!currentWorkflowId) {
      await handleSave();
    }

    if (currentWorkflowId && !isExecuting) {
      await startExecution(currentWorkflowId);
    }
  };

  const handleUpdateNode = useCallback(
    (nodeId: string, data: any) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return { ...node, data };
          }
          return node;
        })
      );

      // Update selected node data
      if (selectedNode && selectedNode.id === nodeId) {
        setSelectedNode({ ...selectedNode, data });
      }
    },
    [selectedNode]
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top Bar */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {workflowName}
          </Typography>

          <Button
            startIcon={<OpenIcon />}
            onClick={() => {
              /* TODO: Open workflow library */
            }}
            sx={{ mr: 1 }}
          >
            Open
          </Button>

          <Button
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={isSaving}
            variant="outlined"
            sx={{ mr: 1 }}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>

          <Button
            startIcon={isExecuting ? <StopIcon /> : <PlayIcon />}
            onClick={handleRun}
            disabled={isExecuting || nodes.length === 0}
            variant="contained"
            color={isExecuting ? 'error' : 'primary'}
          >
            {isExecuting ? 'Running...' : 'Run'}
          </Button>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* Left Sidebar - Node Palette */}
        <NodePalette skills={skills} />

        {/* Center - Canvas */}
        <Box sx={{ flexGrow: 1, position: 'relative', height: '100%' }}>
          <WorkflowCanvas
            initialNodes={nodes}
            initialEdges={edges}
            onNodesChange={setNodes}
            onEdgesChange={setEdges}
            onNodeClick={setSelectedNode}
          />

          {/* Execution Overlay */}
          {isExecuting && <ExecutionOverlay executionState={executionState} />}

          {error && (
            <Box
              sx={{
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                bgcolor: 'error.main',
                color: 'error.contrastText',
                p: 2,
                borderRadius: 1,
                zIndex: 1000,
              }}
            >
              <Typography variant="body2">{error}</Typography>
            </Box>
          )}
        </Box>

        {/* Right Sidebar - Node Config */}
        <NodeConfigPanel
          selectedNode={selectedNode}
          onUpdateNode={handleUpdateNode}
          skills={skills}
          agents={agents}
        />
      </Box>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
        <DialogTitle>Save Workflow</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Workflow Name"
            fullWidth
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={workflowDescription}
            onChange={(e) => setWorkflowDescription(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              setSaveDialogOpen(false);
              handleSave();
            }}
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
