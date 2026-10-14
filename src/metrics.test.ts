import { describe, expect, it } from 'vitest';
import { defaultConfig, queryPath, validateConfig } from './config';
import {
  chartRows,
  fields,
  freshQuery,
  inScope,
  normalize,
  selector,
  type Series,
} from './metrics';

const sample = (metric: string, value: string, labels = {}): Series => ({
  metric: { __name__: metric, UUID: 'GPU-a', Hostname: 'worker-1', ...labels },
  value: [100, value],
});

describe('DCGM normalization', () => {
  it('deduplicates a GPU across scrape targets and pod mappings without adding gauge values', () => {
    const result = normalize([
      sample(fields.utilization, '70', { job: 'one', namespace: 'ml', pod: 'train' }),
      sample(fields.utilization, '70', { job: 'two', namespace: 'ml', pod: 'train' }),
      sample(fields.memoryUsed, '8192'),
      sample(fields.power, '250'),
    ]);
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0].metrics).toEqual({ utilization: 70, memoryUsed: 8192, power: 250 });
    expect(result.devices[0].workloads).toHaveLength(1);
  });
  it('keeps nodes and MIG instances distinct', () => {
    expect(
      normalize([
        sample(fields.memoryUsed, '100'),
        sample(fields.memoryUsed, '200', { GPU_I_ID: '0' }),
        sample(fields.memoryUsed, '300', { GPU_I_ID: '1' }),
        sample(fields.memoryUsed, '400', { Hostname: 'worker-2' }),
      ]).devices
    ).toHaveLength(4);
  });
  it('preserves zero, omits unsupported, invalid and out-of-range values', () => {
    const gpu = normalize([
      sample(fields.utilization, '0'),
      sample(fields.memoryUsed, 'NaN'),
      sample(fields.memoryFree, '9223372036854775794'),
      sample(fields.temperature, '-1'),
      sample(fields.power, '+Inf'),
    ]).devices[0];
    expect(gpu.metrics).toEqual({ utilization: 0 });
    expect(normalize([sample(fields.utilization, '101')]).devices[0].metrics).toEqual({});
  });
  it('uses renamed workload labels rather than the exporter pod, including empty exported labels', () => {
    const gpu = normalize([
      sample(fields.utilization, '20', {
        namespace: 'monitoring',
        pod: 'dcgm-exporter',
        exported_namespace: 'ml',
        exported_pod: 'training',
      }),
    ]).devices[0];
    expect(inScope(gpu, { namespace: 'ml', pod: 'training' })).toBe(true);
    expect(inScope(gpu, { namespace: 'monitoring', pod: 'dcgm-exporter' })).toBe(false);
    expect(
      normalize([
        sample(fields.utilization, '20', {
          pod: 'dcgm-exporter',
          namespace: 'monitoring',
          exported_pod: '',
          exported_namespace: '',
        }),
      ]).devices[0].workloads
    ).toEqual([]);
  });
  it('does not confuse same-name pods in different namespaces or data without UUIDs', () => {
    const gpu = normalize([sample(fields.utilization, '20', { namespace: 'a', pod: 'train' })])
      .devices[0];
    expect(inScope(gpu, { namespace: 'b', pod: 'train' })).toBe(false);
    expect(
      normalize([{ metric: { __name__: fields.utilization, gpu: '0' }, value: [100, '20'] }])
        .ignored
    ).toBe(1);
  });
  it('leaves missing historical samples as gaps and keeps measurements of zero', () => {
    const gpu = normalize([sample(fields.utilization, '20')]).devices[0];
    const history: Series[] = [
      {
        metric: { __name__: fields.utilization, UUID: 'GPU-a', Hostname: 'worker-1' },
        values: [
          [0, '0'],
          [60, '70'],
          [90, 'NaN'],
        ],
      },
    ];
    expect(chartRows(history, gpu, 'utilization', 0, 90, 30).map((r) => r.value)).toEqual([
      0,
      null,
      70,
      null,
    ]);
  });
});

describe('connection configuration', () => {
  it('builds Kubernetes Service proxy paths with a validated optional subpath', () => {
    expect(queryPath({ ...defaultConfig, path: '/prometheus/' }, 'query')).toBe(
      '/api/v1/namespaces/monitoring/services/http:prometheus-operated:9090/proxy/prometheus/api/v1/query'
    );
    for (const path of [
      'https://evil.test',
      '//evil.test',
      '/../secrets',
      '/%2e%2e',
      '/metrics?x=1',
    ])
      expect(validateConfig({ ...defaultConfig, path })).toBeTruthy();
  });
  it('requires a complete cluster filter and quotes literal PromQL values', () => {
    expect(validateConfig({ ...defaultConfig, clusterLabel: 'cluster' })).toBeTruthy();
    expect(
      validateConfig({ ...defaultConfig, clusterLabel: '__name__', clusterValue: 'x' })
    ).toBeTruthy();
    const config = { ...defaultConfig, clusterLabel: 'cluster', clusterValue: 'prod"\\\n' };
    expect(selector(config)).toContain(`cluster=${JSON.stringify(config.clusterValue)}`);
    expect(freshQuery(config)).toContain('timestamp(');
    expect(freshQuery(config)).toContain('or on (__name__)');
    expect(freshQuery(config).split(' or on (__name__) ')).toHaveLength(Object.keys(fields).length);
    expect(freshQuery(config)).toContain('time() - 120');
  });
});
