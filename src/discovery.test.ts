import { describe, expect, it, vi } from 'vitest';
import type { Transport } from './client';
import { discoverSources, serviceConnections } from './discovery';
import { fields, type Series } from './metrics';

const service = (name = 'prometheus', port = 80) => ({
  metadata: { namespace: 'lens-metrics', name },
  spec: { ports: [{ name: 'web', port, targetPort: 9090 }] },
});
const sample = (cluster = 'production', node = 'worker-1'): Series => ({
  metric: { __name__: fields.utilization, UUID: `GPU-${node}`, Hostname: node, cluster },
  value: [100, '50'],
});
function mockTransport(series = [sample()], services = [service()]) {
  return vi.fn<Transport>(async (url) => {
    if (url.startsWith('/api/v1/services?')) return { items: services };
    if (url.startsWith('/api/v1/nodes?')) return { items: [{ metadata: { name: 'worker-1' } }] };
    return { status: 'success', data: { resultType: 'vector', result: series } };
  });
}
const discover = (transport: Transport) =>
  discoverSources(transport, 'main', new AbortController().signal);

describe('Prometheus discovery', () => {
  it('uses the Service port, detects a cluster label and verifies current-cluster Nodes', async () => {
    const transport = mockTransport();
    const result = await discover(transport);
    expect(result.sources).toMatchObject([
      {
        automatic: true,
        devices: 1,
        config: {
          namespace: 'lens-metrics',
          service: 'prometheus',
          port: '80',
          clusterLabel: 'cluster',
          clusterValue: 'production',
        },
      },
    ]);
    expect(transport.mock.calls[2][0]).toContain('http:prometheus:80/proxy/api/v1/query?');
    expect(transport.mock.calls.every(([, options]) => options.cluster === 'main')).toBe(true);
    expect(transport.mock.calls.every(([, options]) => !options.autoLogoutOnAuthError)).toBe(true);
  });

  it('follows Kubernetes pagination and ignores non-query Services and ports', async () => {
    const transport = mockTransport();
    transport.mockImplementationOnce(async () => ({
      items: [service('alertmanager'), service('dcgm-exporter', 9400)],
      metadata: { continue: 'next/token' },
    }));
    const result = await discover(transport);
    expect(result.sources).toHaveLength(1);
    expect(transport.mock.calls.some(([url]) => url.includes('continue=next%2Ftoken'))).toBe(true);
    expect(serviceConnections([service('unrelated'), service('dcgm-exporter', 9400)])).toEqual([]);
    expect(
      serviceConnections([
        {
          ...service(),
          spec: {
            ports: [
              { name: 'https', port: 443 },
              { name: 'grpc', port: 9095 },
            ],
          },
        },
      ])
    ).toMatchObject([{ scheme: 'https', port: '443' }]);
  });

  it('scopes a centralized backend to matching Nodes instead of including a foreign cluster', async () => {
    const result = await discover(mockTransport([sample(), sample('other', 'foreign-worker')]));
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].config.clusterValue).toBe('production');
  });

  it('keeps ambiguous sources for explicit selection', async () => {
    const result = await discover(mockTransport([sample(), sample('another-cluster')]));
    expect(result.sources).toHaveLength(2);
    const backends = await discover(
      mockTransport([sample()], [service(), service('prometheus-ha')])
    );
    expect(backends.sources).toHaveLength(2);
  });

  it('does not automatically select unverified or truncated data', async () => {
    const transport = mockTransport();
    transport.mockImplementationOnce(async () => ({ items: [service()] }));
    transport.mockImplementationOnce(async () => {
      throw { status: 403 };
    });
    expect((await discover(transport)).sources[0].automatic).toBe(false);
    const many = mockTransport(Array.from({ length: 1000 }, () => sample()));
    expect((await discover(many)).sources[0].automatic).toBe(false);
  });

  it('keeps a working source when another backend denies access', async () => {
    const transport = mockTransport([sample()], [service(), service('prometheus-secure')]);
    const fallback = transport.getMockImplementation()!;
    transport.mockImplementation(async (url, options) => {
      if (url.includes('prometheus-secure')) throw { status: 403 };
      return fallback(url, options);
    });
    expect((await discover(transport)).sources).toHaveLength(1);
  });

  it('reports missing telemetry separately from a Service-list permission failure', async () => {
    const empty = await discover(mockTransport([]));
    expect(empty.sources).toEqual([]);
    expect(empty.message).toContain('No recent DCGM GPU metrics');
    const forbidden = vi.fn<Transport>().mockRejectedValue({ status: 403 });
    await expect(discover(forbidden)).rejects.toThrow('permission to list Services');
  });

  it('does not probe any backend after cancellation', async () => {
    const transport = mockTransport();
    const controller = new AbortController();
    controller.abort();
    await expect(discoverSources(transport, 'main', controller.signal)).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  });

  it('aborts a slow probe after five seconds and offers manual configuration', async () => {
    vi.useFakeTimers();
    try {
      const transport = mockTransport();
      const fallback = transport.getMockImplementation()!;
      let probeSignal: AbortSignal | undefined;
      transport.mockImplementation((url, options) => {
        if (url.includes('/proxy/')) {
          probeSignal = options.signal;
          return new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(new Error('Probe timed out.')));
          });
        }
        return fallback(url, options);
      });
      const result = discover(transport);
      await vi.advanceTimersByTimeAsync(5000);
      expect(probeSignal?.aborted).toBe(true);
      expect((await result).message).toContain('Probe timed out.');
    } finally {
      vi.useRealTimers();
    }
  });
});
