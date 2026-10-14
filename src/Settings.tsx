import { Icon } from '@iconify/react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  CircularProgress,
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
import { sourceKey, sourceLabel } from './discovery';
import type { DiscoveryState } from './useDiscovery';

export function Settings({
  initial,
  cluster,
  onSave,
  onClose,
  discovery,
  onDiscover,
  configured = true,
}: {
  initial: ConnectionConfig;
  cluster: string;
  onSave: (config: ConnectionConfig) => void;
  onClose: () => void;
  discovery?: DiscoveryState;
  onDiscover?: () => void;
  configured?: boolean;
}) {
  const [config, setConfig] = useState(initial);
  const [error, setError] = useState<string>();
  const [manual, setManual] = useState(!discovery);
  const selected = discovery?.sources.some((s) => sourceKey(s.config) === sourceKey(config));
  const update = (key: keyof ConnectionConfig, value: string) =>
    setConfig((previous) => ({ ...previous, [key]: value }));
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="gpu-settings-title">
      <BoxForm
        onSubmit={(event) => {
          event.preventDefault();
          const error =
            !configured && !manual && !selected
              ? 'Select a GPU metrics source or enter a manual connection in Advanced settings.'
              : validateConfig(config);
          setError(error);
          if (!error) onSave(config);
        }}
      >
        <DialogTitle id="gpu-settings-title">GPU connection · {cluster}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {discovery && (
              <>
                <Button
                  onClick={onDiscover}
                  disabled={discovery.loading}
                  startIcon={
                    discovery.loading ? (
                      <CircularProgress size={16} />
                    ) : (
                      <Icon icon="mdi:database-search" />
                    )
                  }
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {discovery.loading ? 'Finding Prometheus Services' : 'Discover sources'}
                </Button>
                {discovery.message && <Alert severity="warning">{discovery.message}</Alert>}
                {discovery.sources.length > 0 && (
                  <TextField
                    select
                    label="GPU metrics source"
                    value={selected ? sourceKey(config) : ''}
                    onChange={(event) => {
                      const source = discovery.sources.find(
                        (s) => sourceKey(s.config) === event.target.value
                      );
                      if (source) {
                        setConfig(source.config);
                        setError(undefined);
                      }
                    }}
                    SelectProps={{ MenuProps: { PaperProps: { sx: { maxWidth: '90vw' } } } }}
                    sx={{
                      '& .MuiSelect-select': { whiteSpace: 'normal', overflowWrap: 'anywhere' },
                    }}
                  >
                    {discovery.sources.map((source) => (
                      <MenuItem
                        key={sourceKey(source.config)}
                        value={sourceKey(source.config)}
                        sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}
                      >
                        {sourceLabel(source)}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              </>
            )}
            <Accordion
              defaultExpanded={!discovery}
              onChange={(_event, expanded) => {
                if (expanded) setManual(true);
              }}
              disableGutters
              elevation={0}
            >
              <AccordionSummary expandIcon={<Icon icon="mdi:chevron-down" />}>
                <Typography variant="subtitle2">Advanced settings</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 0 }}>
                <Stack spacing={2}>
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
                </Stack>
              </AccordionDetails>
            </Accordion>
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
