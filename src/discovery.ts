import { errorMessage, response, type Transport } from './client';
import { type ConnectionConfig, defaultConfig, queryPath, validateConfig } from './config';
import { freshQuery, identity, normalize } from './metrics';

interface Service {
  metadata: { namespace: string; name: string; labels?: Record<string, string> };
  spec?: {
    type?: string;
    ports?: { name?: string; port: number; protocol?: string; appProtocol?: string }[];
  };
}

interface ResourceList<T> {
  items: T[];
  metadata?: { continue?: string };
}

export interface DiscoveredSource {
  config: ConnectionConfig;
  devices: number;
  automatic: boolean;
}

export interface DiscoveryResult {
  sources: DiscoveredSource[];
  message?: string;
}

export function sourceKey(config: ConnectionConfig): string {
  return JSON.stringify(config);
}

export function sourceLabel(source: DiscoveredSource): string {
  const { namespace, service, port, clusterLabel, clusterValue } = source.config;
  return `${namespace}/${service}:${port}${
    clusterLabel ? ` · ${clusterLabel}=${clusterValue}` : ''
  } · ${source.devices} GPUs`;
}

export function serviceConnections(services: Service[]): ConnectionConfig[] {
  return services.flatMap(({ metadata, spec }) => {
    const app = [metadata.name, ...Object.values(metadata.labels || {})].join(' ');
    if (
      spec?.type === 'ExternalName' ||
      /exporter|alertmanager/i.test(metadata.name) ||
      !/prometheus|thanos.*quer|victoria.?metrics|vmsingle/i.test(app)
    )
      return [];
    return (spec?.ports || [])
      .filter(
        (port) =>
          (!port.protocol || port.protocol === 'TCP') &&
          !/grpc|gossip/i.test(port.name || '') &&
          (/http|web|prometheus/i.test(port.name || '') ||
            [80, 443, 9090, 8428].includes(port.port))
      )
      .map((port) => ({
        ...defaultConfig,
        namespace: metadata.namespace,
        service: metadata.name,
        port: String(port.port),
        scheme:
          port.appProtocol === 'https' || /https/i.test(port.name || '') || port.port === 443
            ? ('https' as const)
            : ('http' as const),
      }))
      .filter((config) => !validateConfig(config));
  });
}

async function discoveryRequest(
  transport: Transport,
  url: string,
  options: Parameters<Transport>[1]
): Promise<unknown> {
  options.signal.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal.addEventListener('abort', abort, { once: true });
  // The SDK's caller-supplied signal can override its internal timeout signal.
  const timer = setTimeout(abort, options.timeout);
  try {
    return await transport(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    options.signal.removeEventListener('abort', abort);
  }
}

async function list<T>(
  transport: Transport,
  path: string,
  options: Parameters<Transport>[1]
): Promise<T[]> {
  const items: T[] = [];
  let next = '';
  for (let page = 0; page < 10; page++) {
    options.signal.throwIfAborted();
    const params = new URLSearchParams({ limit: '500' });
    if (next) params.set('continue', next);
    const result = (await discoveryRequest(
      transport,
      `${path}?${params}`,
      options
    )) as ResourceList<T>;
    if (!Array.isArray(result?.items)) throw new Error('Kubernetes resource list unavailable.');
    items.push(...result.items);
    next = result.metadata?.continue || '';
    if (!next) return items;
  }
  throw new Error('Discovery reached the resource limit. Enter a connection manually.');
}

export async function discoverSources(
  transport: Transport,
  cluster: string,
  signal: AbortSignal
): Promise<DiscoveryResult> {
  if (!cluster) return { sources: [] };
  const options = { cluster, signal, timeout: 5000, autoLogoutOnAuthError: false };
  const [services, nodes] = await Promise.allSettled([
    list<Service>(transport, '/api/v1/services', options),
    list<{ metadata: { name: string } }>(transport, '/api/v1/nodes', options),
  ]);
  signal.throwIfAborted();
  if (services.status === 'rejected')
    throw new Error(
      'Could not list Services for automatic discovery. Check permission to list Services, or enter a connection manually.'
    );
  const nodeNames = new Set(
    nodes.status === 'fulfilled' ? nodes.value.map((node) => node.metadata.name) : []
  );
  const candidates = serviceConnections(services.value);
  if (candidates.length > 24)
    return {
      sources: [],
      message: 'Too many Prometheus endpoints to probe automatically. Enter a connection manually.',
    };
  const sources: DiscoveredSource[] = [];
  const failures: string[] = [];
  // Probe in small batches so discovery does not flood the API server or metrics backend.
  for (let offset = 0; offset < candidates.length; offset += 4) {
    signal.throwIfAborted();
    await Promise.all(
      candidates.slice(offset, offset + 4).map(async (config) => {
        try {
          const params = new URLSearchParams({ query: freshQuery(config), limit: '1000' });
          const { series, warnings } = response(
            await discoveryRequest(transport, `${queryPath(config, 'query')}?${params}`, options),
            'vector'
          );
          const scopes = [...new Set(series.map((s) => s.metric.cluster || ''))];
          for (const value of scopes) {
            // An empty matcher cannot isolate unlabelled series in the manual connection schema.
            if (!value && scopes.length > 1) continue;
            const scoped = series.filter((s) => (s.metric.cluster || '') === value);
            const { devices } = normalize(scoped);
            if (!devices.length) continue;
            const matched = devices.every((gpu) => gpu.node && nodeNames.has(gpu.node));
            // Exclude known foreign clusters when the current cluster's Nodes are readable.
            if (
              nodeNames.size &&
              devices.every((gpu) => gpu.node) &&
              !scoped.some((s) => nodeNames.has(identity(s.metric)?.node || ''))
            )
              continue;
            sources.push({
              config: { ...config, clusterLabel: value ? 'cluster' : '', clusterValue: value },
              devices: devices.length,
              automatic:
                matched && warnings.length === 0 && !(scopes.length > 1 && scopes.includes('')),
            });
          }
        } catch (error) {
          signal.throwIfAborted();
          failures.push(`${config.namespace}/${config.service}: ${errorMessage(error)}`);
        }
      })
    );
  }
  sources.sort((a, b) => sourceKey(a.config).localeCompare(sourceKey(b.config)));
  return {
    sources,
    message: sources.length
      ? undefined
      : candidates.length === 0
      ? 'No Prometheus Service found. Enter a connection manually.'
      : failures.length === candidates.length
      ? `No Prometheus Service could be queried. ${failures[0]}`
      : 'No recent DCGM GPU metrics matched this cluster. Check DCGM Exporter and Prometheus scrape targets, or enter a connection manually.',
  };
}
