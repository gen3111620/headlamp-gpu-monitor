import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { type ConnectionConfig, validateConfig } from './config';

export function Settings({
  initial,
  cluster,
  onSave,
  onClose,
}: {
  initial: ConnectionConfig;
  cluster: string;
  onSave: (config: ConnectionConfig) => void;
  onClose: () => void;
}) {
  const [config, setConfig] = useState(initial);
  const [error, setError] = useState<string>();
  const update = (key: keyof ConnectionConfig, value: string) =>
    setConfig((previous) => ({ ...previous, [key]: value }));
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="gpu-settings-title">
      <BoxForm
        onSubmit={(event) => {
          event.preventDefault();
          const error = validateConfig(config);
          setError(error);
          if (!error) onSave(config);
        }}
      >
        <DialogTitle id="gpu-settings-title">GPU connection · {cluster}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2">
              Use the Kubernetes Service for Prometheus. Requests use your current Headlamp identity
              and the Kubernetes Service proxy.
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Namespace"
              value={config.namespace}
              onChange={(event) => update('namespace', event.target.value.trim())}
              required
            />
            <TextField
              label="Service name"
              value={config.service}
              onChange={(event) => update('service', event.target.value.trim())}
              required
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Service port"
                value={config.port}
                onChange={(event) => update('port', event.target.value.trim())}
                required
                fullWidth
              />
              <TextField
                select
                label="Protocol"
                value={config.scheme}
                onChange={(event) => update('scheme', event.target.value)}
                sx={{ minWidth: 130 }}
              >
                <MenuItem value="http">HTTP</MenuItem>
                <MenuItem value="https">HTTPS</MenuItem>
              </TextField>
            </Stack>
            <TextField
              label="Prometheus subpath (optional)"
              value={config.path}
              placeholder="/prometheus"
              onChange={(event) => update('path', event.target.value.trim())}
            />
            <Typography variant="subtitle2">Centralized Prometheus (optional)</Typography>
            <Typography variant="body2" color="text.secondary">
              If this Prometheus stores several clusters, set its cluster label and value. Otherwise
              leave both empty. A label filter controls displayed data; it is not an authorization
              boundary.
            </Typography>
            <TextField
              label="Cluster label"
              placeholder="cluster"
              value={config.clusterLabel}
              onChange={(event) => update('clusterLabel', event.target.value.trim())}
            />
            <TextField
              label="Cluster label value"
              value={config.clusterValue}
              onChange={(event) => update('clusterValue', event.target.value)}
            />
            <Typography variant="caption" color="text.secondary">
              Requires DCGM Exporter metrics collected at least once every two minutes. No
              credentials are stored in this configuration.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Save connection
          </Button>
        </DialogActions>
      </BoxForm>
    </Dialog>
  );
}

function BoxForm(props: React.ComponentProps<'form'>) {
  return <form {...props} />;
}
