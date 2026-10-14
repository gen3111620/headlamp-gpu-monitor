import {
  Alert,
  Box,
  createTheme,
  CssBaseline,
  MenuItem,
  Stack,
  TextField,
  ThemeProvider,
} from '@mui/material';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { defaultConfig } from '../../src/config';
import { Dashboard } from '../../src/Dashboard';
import { Settings } from '../../src/Settings';
import { fixtureSnapshot } from '../fixtures';

function Preview() {
  const [mode, setMode] = useState('connected');
  const [dark, setDark] = useState(false);
  const [hours, setHours] = useState(1);
  const [settings, setSettings] = useState(false);
  const data = fixtureSnapshot();
  const state = {
    loading: mode === 'loading',
    data:
      mode === 'denied'
        ? undefined
        : mode === 'empty'
        ? { ...data, devices: [], history: [] }
        : data,
    error:
      mode === 'denied'
        ? 'Access denied. Check permission to read the Prometheus Service proxy.'
        : mode === 'stale'
        ? 'Prometheus connection timed out.'
        : undefined,
  };
  return (
    <ThemeProvider theme={createTheme({ palette: { mode: dark ? 'dark' : 'light' } })}>
      <CssBaseline />
      <Box sx={{ maxWidth: 1440, mx: 'auto', p: 2 }}>
        <Alert severity="info">
          LOCAL PREVIEW · Synthetic test data only. No Kubernetes or GPU connection.
        </Alert>
        <Stack direction="row" spacing={2} sx={{ my: 2 }}>
          <TextField
            select
            label="Preview state"
            size="small"
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            sx={{ minWidth: 180 }}
          >
            {['connected', 'loading', 'empty', 'denied', 'stale', 'unconfigured'].map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Theme"
            size="small"
            value={dark ? 'dark' : 'light'}
            onChange={(event) => setDark(event.target.value === 'dark')}
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="light">Light</MenuItem>
            <MenuItem value="dark">Dark</MenuItem>
          </TextField>
        </Stack>
        <Dashboard
          cluster="demo-cluster"
          state={state}
          configured={mode !== 'unconfigured'}
          hours={hours}
          onHours={setHours}
          onRefresh={() => setMode('connected')}
          onConfigure={() => setSettings(true)}
        />
        {settings && (
          <Settings
            initial={defaultConfig}
            cluster="demo-cluster"
            onClose={() => setSettings(false)}
            onSave={() => setSettings(false)}
          />
        )}
      </Box>
    </ThemeProvider>
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
