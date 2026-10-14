import type { ConnectionConfig } from './config';

export const fields = {
  utilization: 'DCGM_FI_DEV_GPU_UTIL',
  memoryUsed: 'DCGM_FI_DEV_FB_USED',
  memoryFree: 'DCGM_FI_DEV_FB_FREE',
  temperature: 'DCGM_FI_DEV_GPU_TEMP',
  power: 'DCGM_FI_DEV_POWER_USAGE',
} as const;
export type MetricField = keyof typeof fields;
export type Sample = [number, string];
export interface Series {
  metric: Record<string, string>;
  value?: Sample;
  values?: Sample[];
}
export interface Gpu {
  id: string;
  uuid: string;
  node: string;
  model: string;
  instance: string;
  workloads: { namespace: string; pod: string; container: string }[];
  metrics: Partial<Record<MetricField, number>>;
}
export interface Scope {
  node?: string;
  namespace?: string;
  pod?: string;
}
export interface DataSet {
  devices: Gpu[];
  history: Series[];
  fetchedAt: number;
  warnings: string[];
}

// DCGM uses large sentinel values for unsupported fields. Never chart those as measurements.
export function measurement(field: MetricField, raw: string): number | undefined {
  const value = Number(raw);
  const max = { utilization: 100, memoryUsed: 1e9, memoryFree: 1e9, temperature: 200, power: 1e6 };
  return raw.trim() && Number.isFinite(value) && value >= 0 && value <= max[field]
    ? value
    : undefined;
}

export function identity(
  labels: Record<string, string>
): Omit<Gpu, 'metrics' | 'workloads'> | null {
  const uuid = labels.UUID || labels.uuid;
  if (!uuid) return null;
  const node = labels.Hostname || labels.hostname || labels.node || labels.kubernetes_node || '';
  const instance =
    labels.GPU_I_ID || labels.GPU_I_PROFILE || (uuid.startsWith('MIG-') ? 'MIG' : '');
  return {
    id: JSON.stringify([node, uuid, instance]),
    uuid,
    node,
    instance,
    model: labels.modelName || labels.model_name || 'Unknown model',
  };
}

export function workload(labels: Record<string, string>) {
  // Prometheus may rename exporter labels when they collide with scrape target labels.
  // When an exported label exists, the plain label describes the exporter, not the workload.
  const namespace = labels.exported_namespace ?? labels.namespace ?? labels.pod_namespace ?? '';
  const pod = labels.exported_pod ?? labels.pod ?? labels.pod_name ?? '';
  const container = labels.exported_container ?? labels.container ?? labels.container_name ?? '';
  return { namespace, pod, container };
}

export function inScope(gpu: Gpu, scope: Scope): boolean {
  if (scope.node && gpu.node !== scope.node) return false;
  if (
    scope.pod &&
    !gpu.workloads.some((w) => w.pod === scope.pod && w.namespace === scope.namespace)
  )
    return false;
  return true;
}

export function normalize(series: Series[]): { devices: Gpu[]; ignored: number } {
  const devices = new Map<string, Gpu>();
  const timestamps = new Map<string, number>();
  let ignored = 0;
  for (const item of series) {
    const base = identity(item.metric);
    const field = (Object.keys(fields) as MetricField[]).find(
      (f) => fields[f] === item.metric.__name__
    );
    if (!base || !field || !item.value) {
      ignored++;
      continue;
    }
    let gpu = devices.get(base.id);
    if (!gpu) {
      gpu = { ...base, metrics: {}, workloads: [] };
      devices.set(base.id, gpu);
    }
    const w = workload(item.metric);
    if (w.pod && w.namespace && !gpu.workloads.some((x) => JSON.stringify(x) === JSON.stringify(w)))
      gpu.workloads.push(w);
    const value = measurement(field, item.value[1]);
    if (value === undefined) continue;
    const key = base.id + field;
    const previousTime = timestamps.get(key) ?? -Infinity;
    // Duplicate targets and pod labels must not multiply one device's measurements.
    if (item.value[0] > previousTime) {
      gpu.metrics[field] = value;
      timestamps.set(key, item.value[0]);
    } else if (item.value[0] === previousTime) {
      gpu.metrics[field] = Math.max(gpu.metrics[field] ?? 0, value);
    }
  }
  return { devices: [...devices.values()].sort((a, b) => a.id.localeCompare(b.id)), ignored };
}

export function selector(config: ConnectionConfig): string {
  const names = Object.values(fields).join('|');
  const cluster = config.clusterLabel
    ? `,${config.clusterLabel}=${JSON.stringify(config.clusterValue)}`
    : '';
  return `{__name__=~"${names}"${cluster}}`;
}

export function freshQuery(config: ConnectionConfig): string {
  const metric = selector(config);
  // Instant-vector result timestamps are evaluation times, so test the source sample's age in PromQL.
  return `${metric} and (timestamp(${metric}) > time() - 120)`;
}

export function chartRows(
  history: Series[],
  gpu: Gpu,
  field: MetricField,
  start: number,
  end: number,
  step: number
) {
  const values = new Map<number, number>();
  for (const series of history) {
    if (series.metric.__name__ !== fields[field] || identity(series.metric)?.id !== gpu.id)
      continue;
    for (const [time, raw] of series.values || []) {
      const value = measurement(field, raw);
      if (value !== undefined) values.set(time, Math.max(values.get(time) ?? 0, value));
    }
  }
  const rows = [];
  for (let time = start; time <= end; time += step)
    rows.push({ time: time * 1000, value: values.get(time) ?? null });
  return rows;
}
