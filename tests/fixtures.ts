import type { Snapshot } from '../src/client';
import { fields, normalize, type Series } from '../src/metrics';

// Synthetic fixtures for stories and browser tests only. Never imported by the plugin entry point.
export function fixtureResponse(kind: 'vector' | 'matrix', start = 0, end = 3600, step = 30) {
  const devices = [
    {
      UUID: 'GPU-demo-a100-01',
      Hostname: 'gpu-worker-01',
      modelName: 'NVIDIA A100-SXM4-80GB',
      namespace: 'ml-training',
      pod: 'llama-train-0',
      container: 'trainer',
    },
    {
      UUID: 'GPU-demo-a100-02',
      Hostname: 'gpu-worker-01',
      modelName: 'NVIDIA A100-SXM4-80GB',
      namespace: '',
      pod: '',
      container: '',
    },
    {
      UUID: 'GPU-demo-h100-01',
      Hostname: 'gpu-worker-02',
      modelName: 'NVIDIA H100 80GB HBM3',
      namespace: 'inference',
      pod: 'vllm-server-0',
      container: 'server',
    },
  ];
  const result: Series[] = devices.flatMap((labels, i) =>
    Object.entries(fields).map(([key, metric]) => {
      const value = (
        {
          utilization: [78, 0, 92],
          memoryUsed: [57344, 2048, 65536],
          memoryFree: [24576, 79872, 16384],
          temperature: [62, 35, 69],
          power: [245, 48, 310],
        } as Record<string, number[]>
      )[key][i];
      const values: [number, string][] = [];
      for (let time = start; time <= end; time += step)
        values.push([
          time,
          String(value === 0 ? 0 : Math.max(0, value * (0.86 + 0.1 * Math.sin(time / 500 + i)))),
        ]);
      return {
        metric: { __name__: metric, ...labels },
        ...(kind === 'vector' ? { value: [end, String(value)] as [number, string] } : { values }),
      };
    })
  );
  return { status: 'success', data: { resultType: kind, result } };
}

export function fixtureSnapshot(): Snapshot {
  const end = 1735689600;
  const start = end - 3600;
  return {
    devices: normalize(fixtureResponse('vector').data.result).devices,
    history: fixtureResponse('matrix', start, end).data.result,
    start,
    end,
    step: 30,
    warnings: [],
    fetchedAt: end * 1000,
  };
}
