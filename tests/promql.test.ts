import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { defaultConfig } from '../src/config';
import { freshQuery } from '../src/metrics';

it('evaluates the actual plugin PromQL in Prometheus, excluding old samples and other clusters', () => {
  const directory = mkdtempSync(join(tmpdir(), 'gpu-promql-'));
  const labels = 'DCGM_FI_DEV_GPU_UTIL{UUID="GPU-a",cluster="production"}';
  const zero = 'DCGM_FI_DEV_GPU_UTIL{UUID="GPU-zero",cluster="production"}';
  const memory = 'DCGM_FI_DEV_FB_USED{UUID="GPU-a",cluster="production"}';
  const expr = freshQuery({
    ...defaultConfig,
    clusterLabel: 'cluster',
    clusterValue: 'production',
  });
  const tests = {
    evaluation_interval: '30s',
    tests: [
      {
        interval: '30s',
        input_series: [
          { series: labels, values: '50 _ _ _ _ _' },
          { series: zero, values: '0 _ _ _ _ _' },
          { series: memory, values: '8192 _ _ _ _ _' },
          { series: 'DCGM_FI_DEV_GPU_UTIL{UUID="GPU-other",cluster="other"}', values: '90+0x5' },
        ],
        promql_expr_test: [
          {
            expr,
            eval_time: '1m',
            exp_samples: [
              { labels, value: 50 },
              { labels: zero, value: 0 },
              { labels: memory, value: 8192 },
            ],
          },
          { expr, eval_time: '2m30s', exp_samples: [] },
        ],
      },
    ],
  };
  try {
    chmodSync(directory, 0o755);
    writeFileSync(join(directory, 'metrics.yml'), JSON.stringify(tests));
    const output = process.env.PROMTOOL_PATH
      ? execFileSync(process.env.PROMTOOL_PATH, ['test', 'rules', join(directory, 'metrics.yml')], {
          encoding: 'utf8',
          timeout: 25000,
        })
      : execFileSync(
          'docker',
          [
            'run',
            '--rm',
            '-v',
            `${directory}:/tests:ro`,
            '--entrypoint',
            '/bin/promtool',
            'prom/prometheus:v3.5.0',
            'test',
            'rules',
            '/tests/metrics.yml',
          ],
          { encoding: 'utf8', timeout: 25000 }
        );
    expect(output).toContain('SUCCESS');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
