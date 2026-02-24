import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Button,
  Paper,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  Fab,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { WorkflowCard } from './WorkflowCard';
import { useNavigate } from 'react-router-dom';

interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: string;
  created_at: string;
  tasks?: any[];
}

export const WorkflowLibrary: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    setLoading(true);
    setError(null);

    try {
      if (window.go?.main?.App) {
        const wfs = await (window as any).go.main.App.ListSavedWorkflows();
        setWorkflows(wfs || []);
      }
    } catch (err) {
      console.error('Failed to load workflows:', err);
      setError('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (window.go?.main?.App) {
        await (window as any).go.main.App.DeleteWorkflow(id);
        await loadWorkflows();
      }
    } catch (err) {
      console.error('Failed to delete workflow:', err);
      setError('Failed to delete workflow');
    }
  };

  const handleLoad = (id: string) => {
    navigate(\`/designer?workflowId=\${id}\`);
  };

  const handleRun = async (id: string) => {
    try {
      if (window.go?.main?.App) {
        await (window as any).go.main.App.StartWorkflowWithEvents(id);
        navigate(\`/designer?workflowId=\${id}\`);
      }
    } catch (err) {
      console.error('Failed to run workflow:', err);
      setError('Failed to run workflow');
    }
  };

  const handleCreateNew = () => {
    navigate('/designer');
  };

  const filteredWorkflows = workflows.filter((workflow) => {
    const query = searchQuery.toLowerCase();
    return (
      workflow.name.toLowerCase().includes(query) ||
      (workflow.description && workflow.description.toLowerCase().includes(query))
    );
  });

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, minHeight: '100vh', backgroundColor: 'background.default' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Workflow Library</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<RefreshIcon />} onClick={loadWorkflows} variant="outlined">
            Refresh
          </Button>
          <Button startIcon={<AddIcon />} onClick={handleCreateNew} variant="contained">
            New Workflow
          </Button>
        </Box>
      </Box>

      {/* Search */}
      <TextField
        fullWidth
        placeholder="Search workflows..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Workflow Grid */}
      {filteredWorkflows.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {searchQuery ? 'No workflows found' : 'No workflows yet'}
          </Typography>
          {!searchQuery && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Create your first workflow to get started
              </Typography>
              <Button startIcon={<AddIcon />} onClick={handleCreateNew} variant="contained">
                Create Workflow
              </Button>
            </>
          )}
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredWorkflows.map((workflow) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={workflow.id}>
              <WorkflowCard
                workflow={workflow}
                onLoad={() => handleLoad(workflow.id)}
                onRun={() => handleRun(workflow.id)}
                onDelete={() => handleDelete(workflow.id)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
        onClick={handleCreateNew}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};
