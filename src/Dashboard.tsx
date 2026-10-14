import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { chartRows, inScope, type MetricField, type Scope } from './metrics';
import type { DiscoveryState } from './useDiscovery';
import type { MetricsState } from './useMetrics';

export interface DashboardProps {
  cluster: string;
  state: MetricsState;
  configured: boolean;
  discovery?: DiscoveryState;
  scope?: Scope;
  hours: number;
  onHours: (hours: number) => void;
  onRefresh: () => void;
  onConfigure: () => void;
}

const displayFields: Record<MetricField, { label: string; unit: string }> = {
  utilization: { label: 'GPU utilization', unit: '%' },
  memoryUsed: { label: 'GPU memory used', unit: 'MiB' },
  memoryFree: { label: 'GPU memory free', unit: 'MiB' },
  temperature: { label: 'Temperature', unit: '°C' },
  power: { label: 'Power draw', unit: 'W' },
};
const number = (value: number | undefined, unit = '') =>
  value === undefined
    ? '—'
    : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${unit}`;

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, flex: 1, minWidth: 180 }}>
      <Typography color="text.secondary" variant="body2">
        {label}
      </Typography>
      <Typography variant="h4" sx={{ my: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      <Typography color="text.secondary" variant="caption">
        {detail}
      </Typography>
    </Paper>
  );
}

export function Dashboard({
  cluster,
  state,
  configured,
  discovery,
  scope = {},
  hours,
  onHours,
  onRefresh,
  onConfigure,
}: DashboardProps) {
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [field, setField] = useState<MetricField>('utilization');
  const scoped = (state.data?.devices || []).filter((gpu) => inScope(gpu, scope));
  const devices = scoped.filter((gpu) =>
    `${gpu.node} ${gpu.uuid} ${gpu.model} ${gpu.workloads
      .map((w) => `${w.namespace}/${w.pod}`)
      .join(' ')}`
      .toLowerCase()
      .includes(filter.toLowerCase())
  );
  const selected = devices.find((gpu) => gpu.id === selectedId) || devices[0];
  const full = devices.filter((gpu) => !gpu.instance);
  const utilized = full.flatMap((gpu) =>
    gpu.metrics.utilization === undefined ? [] : [gpu.metrics.utilization]
  );
  const memory = full.filter(
    (gpu) => gpu.metrics.memoryUsed !== undefined && gpu.metrics.memoryFree !== undefined
  );
  const used = memory.reduce((total, gpu) => total + gpu.metrics.memoryUsed!, 0) / 1024;
  const total =
    memory.reduce((sum, gpu) => sum + gpu.metrics.memoryUsed! + gpu.metrics.memoryFree!, 0) / 1024;
  const rows =
    selected && state.data
      ? chartRows(
          state.data.history,
          selected,
          field,
          state.data.start,
          state.data.end,
          state.data.step
        )
      : [];
  const hasHistory = rows.some((row) => row.value !== null);
  const meta = displayFields[field];

  return (
    <Box sx={{ p: { xs: 1, md: 3 }, minWidth: 0 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={2}
        flexWrap="wrap"
        sx={{ mb: 3 }}
      >
        <Box>
          <Stack direction="row" gap={1} alignItems="center">
            <Typography variant="h5" component={scope.node || scope.pod ? 'h2' : 'h1'}>
              GPU Monitor
            </Typography>
            {state.data && (
              <Chip
                size="small"
                label={state.error ? 'Stale readings' : 'Connected'}
                color={state.error ? 'warning' : 'success'}
                variant="outlined"
              />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {cluster || 'No cluster selected'} · NVIDIA DCGM · refreshes every 30 seconds
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Button
            onClick={onRefresh}
            disabled={configured ? state.loading : !discovery || discovery.loading}
          >
            Refresh
          </Button>
          <Button variant="outlined" onClick={onConfigure} disabled={!cluster}>
            Connection settings
          </Button>
        </Stack>
      </Stack>
      {!cluster ? (
        <Alert severity="info">Select a single cluster to view GPU metrics.</Alert>
      ) : !configured ? (
        discovery?.loading ? (
          <Stack direction="row" spacing={1} alignItems="center" role="status">
            <CircularProgress size={20} />
            <Typography>Finding GPU metrics sources...</Typography>
          </Stack>
        ) : (
          <Alert
            severity={discovery?.message ? 'warning' : 'info'}
            action={
              <Button color="inherit" onClick={onConfigure}>
                {discovery?.sources.length ? 'Select source' : 'Configure'}
              </Button>
            }
          >
            {discovery?.message ||
              (discovery?.sources.length
                ? 'Select a GPU metrics source for this cluster.'
                : 'Connect to a Prometheus Service that collects NVIDIA DCGM Exporter metrics.')}
          </Alert>
        )
      ) : (
        <Stack spacing={2.5}>
          {state.error && (
            <Alert severity="error">
              {state.error}
              {state.data && ' Showing last successful readings; they are not current.'}
            </Alert>
          )}
          {state.data?.warnings.map((warning) => (
            <Alert key={warning} severity="warning">
              {warning}
            </Alert>
          ))}
          {state.loading ? (
            <Box role="status" aria-label="Loading GPU metrics">
              <Skeleton height={140} />
              <Skeleton height={280} />
            </Box>
          ) : (
            <>
              {state.data && (
                <Typography variant="caption" color="text.secondary">
                  Last successful query: {new Date(state.data.fetchedAt).toLocaleString()}. Only
                  source samples newer than two minutes are included.
                </Typography>
              )}
              {state.data && scoped.length === 0 ? (
                <Alert severity="info">
                  {scope.pod
                    ? 'No GPU metrics mapped to this Pod. Check DCGM workload labels; shared GPUs may not support per-container attribution.'
                    : scope.node
                    ? 'No recent GPU metrics matched this Node. Check the exporter hostname/node labels.'
                    : 'No recent GPU metrics found. Check DCGM Exporter, Prometheus scrape targets and the cluster label filter.'}
                </Alert>
              ) : (
                state.data && (
                  <>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                      <Stat
                        label="Full-GPU entities"
                        value={String(full.length)}
                        detail={`${
                          devices.filter((gpu) => gpu.instance).length
                        } MIG entities shown separately`}
                      />
                      <Stat
                        label="Average GPU utilization"
                        value={number(
                          utilized.length
                            ? utilized.reduce((a, b) => a + b, 0) / utilized.length
                            : undefined,
                          '%'
                        )}
                        detail={`${utilized.length} full-GPU readings · not scheduler allocation`}
                      />
                      <Stat
                        label="GPU memory used / usable"
                        value={memory.length ? `${number(used)} / ${number(total)} GiB` : '—'}
                        detail={`${memory.length} full-GPU readings · excludes reserved memory`}
                      />
                    </Stack>
                    <Paper variant="outlined" sx={{ minWidth: 0 }}>
                      <Box sx={{ p: 2 }}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          gap={2}
                          flexWrap="wrap"
                          alignItems="center"
                        >
                          <Typography variant="h6" component="h2">
                            GPU devices
                          </Typography>
                          <TextField
                            size="small"
                            label="Filter GPUs"
                            placeholder="Node, model, UUID or Pod"
                            value={filter}
                            onChange={(event) => setFilter(event.target.value)}
                            sx={{ minWidth: 260 }}
                          />
                        </Stack>
                      </Box>
                      <TableContainer>
                        <Table size="small" aria-label="GPU metrics" sx={{ minWidth: 960 }}>
                          <TableHead>
                            <TableRow>
                              {[
                                'Device / model',
                                'Node',
                                'Utilization',
                                'Memory used',
                                'Temperature',
                                'Power',
                                'Workload labels',
                              ].map((label) => (
                                <TableCell key={label}>{label}</TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {devices.map((gpu) => (
                              <TableRow key={gpu.id} selected={selected?.id === gpu.id}>
                                <TableCell>
                                  <Button
                                    size="small"
                                    onClick={() => setSelectedId(gpu.id)}
                                    sx={{
                                      textTransform: 'none',
                                      justifyContent: 'flex-start',
                                      p: 0,
                                    }}
                                  >
                                    {gpu.uuid}
                                  </Button>
                                  <Typography
                                    variant="caption"
                                    display="block"
                                    color="text.secondary"
                                  >
                                    {gpu.model}
                                    {gpu.instance && ` · MIG ${gpu.instance}`}
                                  </Typography>
                                </TableCell>
                                <TableCell>{gpu.node || 'Unknown'}</TableCell>
                                <TableCell>{number(gpu.metrics.utilization, '%')}</TableCell>
                                <TableCell>
                                  {number(
                                    gpu.metrics.memoryUsed === undefined
                                      ? undefined
                                      : gpu.metrics.memoryUsed / 1024,
                                    ' GiB'
                                  )}
                                </TableCell>
                                <TableCell>{number(gpu.metrics.temperature, ' °C')}</TableCell>
                                <TableCell>{number(gpu.metrics.power, ' W')}</TableCell>
                                <TableCell>
                                  {gpu.workloads.length
                                    ? gpu.workloads.map((w) => (
                                        <Typography
                                          key={`${w.namespace}/${w.pod}/${w.container}`}
                                          variant="caption"
                                          display="block"
                                        >
                                          {w.namespace}/{w.pod}
                                          {w.container && ` (${w.container})`}
                                        </Typography>
                                      ))
                                    : 'Not attributed'}
                                </TableCell>
                              </TableRow>
                            ))}
                            {devices.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={7}>No GPUs match this filter.</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ p: 2 }}
                      >
                        — means unavailable. MIG and full-GPU metrics are never combined in the
                        summaries. Workload labels identify associated devices, not exclusive
                        per-Pod consumption.
                      </Typography>
                    </Paper>
                    {selected && (
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          gap={2}
                          flexWrap="wrap"
                          alignItems="center"
                          sx={{ mb: 2 }}
                        >
                          <Box>
                            <Typography variant="h6" component="h2">
                              GPU history
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {selected.node || 'Unknown node'} · {selected.uuid}
                              {selected.instance && ` · MIG ${selected.instance}`}
                            </Typography>
                          </Box>
                          <Stack direction="row" gap={2} flexWrap="wrap">
                            <FormControl size="small" sx={{ minWidth: 170 }}>
                              <InputLabel id="gpu-field-label">Metric</InputLabel>
                              <Select
                                labelId="gpu-field-label"
                                label="Metric"
                                value={field}
                                onChange={(event) => setField(event.target.value as MetricField)}
                              >
                                {Object.entries(displayFields).map(([key, value]) => (
                                  <MenuItem key={key} value={key}>
                                    {value.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ minWidth: 130 }}>
                              <InputLabel id="gpu-range-label">Time range</InputLabel>
                              <Select
                                labelId="gpu-range-label"
                                label="Time range"
                                value={hours}
                                onChange={(event) => onHours(Number(event.target.value))}
                              >
                                {[1, 6, 24].map((h) => (
                                  <MenuItem key={h} value={h}>
                                    Last {h} hour{h > 1 ? 's' : ''}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Stack>
                        </Stack>
                        {hasHistory ? (
                          <Box
                            role="img"
                            aria-label={`${meta.label} history for ${selected.uuid}`}
                            sx={{ height: 280, overflow: 'hidden' }}
                          >
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={rows}
                                margin={{ top: 10, right: 25, left: 10, bottom: 10 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis
                                  dataKey="time"
                                  type="number"
                                  domain={['dataMin', 'dataMax']}
                                  tickFormatter={(time) =>
                                    new Date(time).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  }
                                  minTickGap={50}
                                />
                                <YAxis
                                  width={65}
                                  domain={field === 'utilization' ? [0, 100] : [0, 'auto']}
                                  unit={meta.unit === '%' ? '%' : undefined}
                                />
                                <Tooltip
                                  labelFormatter={(time) => new Date(Number(time)).toLocaleString()}
                                  formatter={(value) => [
                                    number(Number(value), ` ${meta.unit}`),
                                    meta.label,
                                  ]}
                                />
                                <Line
                                  type="linear"
                                  dataKey="value"
                                  stroke="#2196f3"
                                  strokeWidth={2}
                                  dot={false}
                                  connectNulls={false}
                                  isAnimationActive={false}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </Box>
                        ) : (
                          <Alert severity="info">
                            No historical samples for this metric and time range.
                          </Alert>
                        )}
                      </Paper>
                    )}
                  </>
                )
              )}
            </>
          )}
        </Stack>
      )}
    </Box>
  );
}
