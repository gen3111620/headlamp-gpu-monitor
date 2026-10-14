import { expect, test } from '@playwright/test';
import { fixtureResponse } from './fixtures';

test('loads the built plugin in Headlamp and queries the selected Service', async ({ page }) => {
  test.skip(
    !process.env.HEADLAMP_TEST_URL,
    'Set HEADLAMP_TEST_URL to an isolated Headlamp with the built plugin installed.'
  );
  const errors: string[] = [];
  const queries: string[] = [];
  let denied = false;
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/config', (route) =>
    route.fulfill({
      json: {
        clusters: [
          { name: 'gpu-demo', auth_type: '', useToken: false },
          { name: 'other-demo', auth_type: '', useToken: false },
        ],
      },
    })
  );
  await page.route('**/clusters/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/query') || url.pathname.endsWith('/query_range')) {
      queries.push(url.pathname);
      if (denied) return route.fulfill({ status: 403, json: { message: 'forbidden' } });
      return route.fulfill({
        json: url.pathname.endsWith('/query_range')
          ? fixtureResponse(
              'matrix',
              Number(url.searchParams.get('start')),
              Number(url.searchParams.get('end')),
              Number(url.searchParams.get('step'))
            )
          : fixtureResponse('vector'),
      });
    }
    if (url.pathname.endsWith('/me')) return route.fulfill({ json: { name: 'local-test-user' } });
    if (url.pathname.endsWith('/version'))
      return route.fulfill({ json: { major: '1', minor: '32', gitVersion: 'v1.32.0' } });
    if (url.pathname.endsWith('/api/v1/nodes/gpu-worker-01'))
      return route.fulfill({
        json: {
          kind: 'Node',
          apiVersion: 'v1',
          metadata: { name: 'gpu-worker-01', uid: 'test-node', resourceVersion: '1' },
          spec: {},
          status: {
            capacity: { cpu: '8', memory: '32Gi', pods: '110', 'nvidia.com/gpu': '2' },
            allocatable: { cpu: '8', memory: '32Gi', pods: '110', 'nvidia.com/gpu': '2' },
            conditions: [{ type: 'Ready', status: 'True' }],
            nodeInfo: {
              architecture: 'amd64',
              operatingSystem: 'linux',
              kubeletVersion: 'v1.32.0',
            },
          },
        },
      });
    if (url.pathname.endsWith('/api/v1/namespaces/ml-training/pods/llama-train-0'))
      return route.fulfill({
        json: {
          kind: 'Pod',
          apiVersion: 'v1',
          metadata: {
            namespace: 'ml-training',
            name: 'llama-train-0',
            uid: 'test-pod',
            resourceVersion: '1',
          },
          spec: {
            nodeName: 'gpu-worker-01',
            containers: [
              {
                name: 'trainer',
                image: 'example.invalid/test',
                resources: { limits: { 'nvidia.com/gpu': '1' } },
              },
            ],
          },
          status: { phase: 'Running', conditions: [], containerStatuses: [] },
        },
      });
    if (url.pathname.includes('selfsubject'))
      return route.fulfill({
        json: { status: { allowed: true, resourceRules: [], nonResourceRules: [] } },
      });
    return route.fulfill({
      json: {
        kind: 'List',
        apiVersion: 'v1',
        metadata: { resourceVersion: '1' },
        items: [],
        groups: [],
        resources: [],
      },
    });
  });
  await page.goto(`${process.env.HEADLAMP_TEST_URL}/c/gpu-demo/gpu-monitor`);
  await expect(page.getByRole('heading', { name: 'GPU Monitor', exact: true })).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole('button', { name: 'Connection settings' }).click();
  await page.getByRole('textbox', { name: /^Service name/ }).fill('gpu-prometheus');
  await page.getByLabel('Cluster label', { exact: true }).fill('cluster');
  await page.getByLabel('Cluster label value', { exact: true }).fill('production');
  await page.getByRole('button', { name: 'Save connection', exact: true }).click();
  await expect(page.getByRole('cell', { name: '78%', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /GPU utilization history/ })).toBeVisible();
  expect(
    queries.some(
      (path) => path.includes('/clusters/gpu-demo/') && path.includes('http:gpu-prometheus:9090')
    )
  ).toBe(true);
  await page.evaluate(() => {
    const banner = document.createElement('div');
    banner.textContent = 'INTEGRATION TEST · Synthetic GPU metrics';
    banner.setAttribute(
      'style',
      'position:fixed;bottom:0;right:0;background:#fff3cd;color:#553c00;padding:8px;z-index:9999;font:14px sans-serif'
    );
    document.body.appendChild(banner);
  });
  await page.screenshot({ path: 'docs/screenshots/headlamp-integration.png', fullPage: true });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('pluginConfigs')))
    .toContain('gpu-prometheus');
  await page.reload();
  await expect(page.getByRole('cell', { name: '78%', exact: true })).toBeVisible();
  await page.goto(`${process.env.HEADLAMP_TEST_URL}/c/gpu-demo/nodes/gpu-worker-01`);
  await expect(page.getByRole('heading', { name: 'GPU Monitor', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'GPU-demo-a100-01', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'GPU-demo-a100-02', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'GPU-demo-h100-01', exact: true })).toHaveCount(0);
  await page.goto(`${process.env.HEADLAMP_TEST_URL}/c/gpu-demo/pods/ml-training/llama-train-0`);
  await expect(page.getByRole('heading', { name: 'GPU Monitor', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'GPU-demo-a100-01', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'GPU-demo-a100-02', exact: true })).toHaveCount(0);
  await page.goto(`${process.env.HEADLAMP_TEST_URL}/c/gpu-demo/gpu-monitor`);
  denied = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByText(/Access denied. Check your Headlamp login/)).toBeVisible();
  await page.goto(`${process.env.HEADLAMP_TEST_URL}/c/other-demo/gpu-monitor`);
  await expect(
    page.getByText('Connect to a Prometheus Service that collects NVIDIA DCGM Exporter metrics.')
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'GPU-demo-a100-01', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
