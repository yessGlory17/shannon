import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Box,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Edit as EditIcon,
  MoreVert as MoreIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useState } from 'react';

interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: string;
  created_at: string;
  tasks?: any[];
}

interface WorkflowCardProps {
  workflow: Workflow;
  onLoad: () => void;
  onRun: () => void;
  onDelete: () => void;
}

export const WorkflowCard: React.FC<WorkflowCardProps> = ({
  workflow,
  onLoad,
  onRun,
  onDelete,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDelete = () => {
    handleMenuClose();
    onDelete();
  };

  const taskCount = workflow.tasks?.length || 0;

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {workflow.name}
          </Typography>
          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreIcon />
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
            <MenuItem onClick={handleDelete}>
              <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
              Delete
            </MenuItem>
          </Menu>
        </Box>

        {workflow.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {workflow.description}
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label={\`\${taskCount} tasks\`} size="small" variant="outlined" />
          <Chip
            label={workflow.status}
            size="small"
            color={
              workflow.status === 'completed'
                ? 'success'
                : workflow.status === 'running'
                ? 'info'
                : 'default'
            }
          />
        </Box>

        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
          Created: {new Date(workflow.created_at).toLocaleDateString()}
        </Typography>
      </CardContent>

      <CardActions>
        <Button size="small" startIcon={<EditIcon />} onClick={onLoad}>
          Edit
        </Button>
        <Button size="small" startIcon={<PlayIcon />} onClick={onRun} variant="contained">
          Run
        </Button>
      </CardActions>
    </Card>
  );
};
