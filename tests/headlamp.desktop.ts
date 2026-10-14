import { _electron as electron, type ElectronApplication, expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('loads the packaged plugin in Linux Desktop and discovers live GPU metrics', async () => {
  const executable = process.env.HEADLAMP_DESKTOP_EXECUTABLE;
  const kubeconfig = process.env.HEADLAMP_DESKTOP_KUBECONFIG;
  const cluster = process.env.HEADLAMP_DESKTOP_CONTEXT;
  test.skip(
    process.platform !== 'linux' || !executable || !kubeconfig || !cluster,
    'Set HEADLAMP_DESKTOP_EXECUTABLE, HEADLAMP_DESKTOP_KUBECONFIG and HEADLAMP_DESKTOP_CONTEXT on Linux.'
  );
  const pkg = JSON.parse(await readFile(resolve('package.json'), 'utf8'));
  const profile = await mkdtemp(join(tmpdir(), 'gpu-monitor-desktop-'));
  const config = join(profile, 'config');
  const plugins = join(config, 'Headlamp', 'user-plugins');
  let app: ElectronApplication | undefined;
  try {
    await mkdir(plugins, { recursive: true });
    execFileSync('tar', [
      '-xzf',
      resolve(`artifacts/${pkg.name}-${pkg.version}.tar.gz`),
      '-C',
      plugins,
    ]);
    const installed = JSON.parse(await readFile(join(plugins, pkg.name, 'package.json'), 'utf8'));
    expect(installed.name).toBe(pkg.name);
    expect(installed.version).toBe(pkg.version);
    app = await electron.launch({
      executablePath: executable,
      args: ['--no-sandbox', '--disable-gpu', '--port=4469'],
      env: {
        ...process.env,
        XDG_CONFIG_HOME: config,
        XDG_DATA_HOME: join(profile, 'data'),
        XDG_CACHE_HOME: join(profile, 'cache'),
        XDG_STATE_HOME: join(profile, 'state'),
        KUBECONFIG: kubeconfig!,
      },
      timeout: 60000,
    });
    const page = await app.firstWindow();
    const errors: string[] = [];
    const failures: number[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.url().includes('/proxy/api/v1/query') && !response.ok())
        failures.push(response.status());
    });
    await expect(page.getByText('Plugin Catalog', { exact: true }).first()).toBeVisible({
      timeout: 30000,
    });
    await page.screenshot({ path: 'artifacts/desktop-catalog.png' });
    await page.evaluate((path) => {
      window.location.hash = path;
    }, `/c/${encodeURIComponent(cluster!)}/gpu-monitor`);
    await expect(page.getByRole('heading', { name: 'GPU Monitor', exact: true })).toBeVisible();
    await expect(page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 30000 });
    const table = page.getByRole('table', { name: 'GPU metrics' });
    await expect(table).toBeVisible();
    const count = process.env.HEADLAMP_DESKTOP_EXPECT_GPU_COUNT;
    if (count) await expect(table.getByRole('row')).toHaveCount(Number(count) + 1);
    else expect(await table.getByRole('row').count()).toBeGreaterThan(1);
    await expect(page.getByRole('img', { name: /GPU utilization history/ })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('pluginConfigs')))
      .toContain(pkg.name);
    await page.screenshot({ path: 'artifacts/desktop-live-gpu.png', fullPage: true });
    await page.reload();
    await expect(page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 30000 });
    expect(failures).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    try {
      await app?.close();
    } finally {
      await rm(profile, { recursive: true, force: true });
    }
  }
});
