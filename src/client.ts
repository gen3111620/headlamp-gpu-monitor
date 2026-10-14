import { type ConnectionConfig, queryPath } from './config';
import { type DataSet, freshQuery, normalize, type Series } from './metrics';

export type Transport = (
  url: string,
  options: { cluster: string; signal: AbortSignal; timeout: number; autoLogoutOnAuthError: boolean }
) => Promise<unknown>;
export interface Snapshot extends DataSet {
  start: number;
  end: number;
  step: number;
}

export function response(
  value: unknown,
  kind: 'vector' | 'matrix'
): { series: Series[]; warnings: string[] } {
  const body = value as {
    status?: string;
    error?: string;
    warnings?: unknown;
    data?: { resultType?: string; result?: unknown };
  };
  if (!body || body.status !== 'success')
    throw new Error(body?.error || 'Prometheus did not return a successful response.');
  if (body.data?.resultType !== kind || !Array.isArray(body.data.result))
    throw new Error('The Service did not return the expected Prometheus response.');
  const series = body.data.result as Series[];
  if (
    series.some(
      (s) =>
        !s ||
        typeof s.metric !== 'object' ||
        s.metric === null ||
        (kind === 'vector'
          ? !validSample(s.value)
          : !Array.isArray(s.values) || !s.values.every(validSample))
    )
  )
    throw new Error('Prometheus returned malformed samples.');
  const warnings = Array.isArray(body.warnings) ? body.warnings.map(String) : [];
  if (series.length >= 1000)
    warnings.push(
      'The 1,000-series limit was reached. Results may be incomplete; narrow the cluster scope.'
    );
  return { series, warnings };
}

function validSample(sample: unknown): boolean {
  return (
    Array.isArray(sample) &&
    sample.length === 2 &&
    Number.isFinite(sample[0]) &&
    typeof sample[1] === 'string'
  );
}

export function errorMessage(error: unknown): string {
  const detail = error as { status?: number; message?: string };
  if (detail?.status === 401 || detail?.status === 403)
    return 'Access denied. Check your Headlamp login and permission to read the Prometheus Service proxy.';
  if (detail?.status === 404)
    return 'Prometheus Service or API path not found. Check the connection settings.';
  return (
    detail?.message || 'Could not query Prometheus. Check the Service, network and permissions.'
  );
}

export async function loadSnapshot(
  transport: Transport,
  config: ConnectionConfig,
  cluster: string,
  hours: number,
  signal: AbortSignal,
  now = Date.now()
): Promise<Snapshot> {
  if (!cluster) throw new Error('Select a single cluster to view GPU metrics.');
  if (![1, 6, 24].includes(hours)) throw new Error('Unsupported time range.');
  const step = Math.max(30, Math.ceil((hours * 3600) / 240));
  const end = Math.floor(now / 1000 / step) * step;
  const start = end - hours * 3600;
  const query = freshQuery(config);
  const common = { cluster, signal, timeout: 15000, autoLogoutOnAuthError: false };
  const instantParams = new URLSearchParams({ query, limit: '1000' });
  const rangeParams = new URLSearchParams({
    query,
    start: String(start),
    end: String(end),
    step: String(step),
    limit: '1000',
  });
  const [instantValue, historyResult] = await Promise.all([
    transport(`${queryPath(config, 'query')}?${instantParams}`, common),
    transport(`${queryPath(config, 'query_range')}?${rangeParams}`, common)
      .then((value) => ({ value, error: undefined }))
      .catch((error: unknown) => ({ value: undefined, error })),
  ]);
  const instant = response(instantValue, 'vector');
  let history: Series[] = [];
  const warnings = [...instant.warnings];
  if (historyResult.error)
    warnings.push(`History unavailable: ${errorMessage(historyResult.error)}`);
  else {
    try {
      const range = response(historyResult.value, 'matrix');
      history = range.series;
      warnings.push(...range.warnings);
    } catch (error) {
      warnings.push(`History unavailable: ${errorMessage(error)}`);
    }
  }
  const normalized = normalize(instant.series);
  if (normalized.ignored)
    warnings.push(
      `${normalized.ignored} samples could not be identified as DCGM GPU metrics (a UUID label is required).`
    );
  return {
    devices: normalized.devices,
    history,
    fetchedAt: now,
    start,
    end,
    step,
    warnings: [...new Set(warnings)],
  };
}
