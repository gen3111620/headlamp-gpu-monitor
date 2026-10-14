import { expect, test } from '@playwright/test';

test('renders measurements, filters, charts and settings in light and dark themes', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'GPU Monitor' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '0%', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /GPU utilization history/ })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/preview-light.png', fullPage: true });
  await page.getByLabel('Filter GPUs').fill('vllm');
  await expect(page.getByRole('button', { name: 'GPU-demo-a100-01', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'GPU-demo-h100-01', exact: true })).toBeVisible();
  await page.getByLabel('Filter GPUs').fill('');
  await page.getByLabel('Theme', { exact: true }).click();
  await page.getByRole('option', { name: 'Dark', exact: true }).click();
  await page.screenshot({ path: 'docs/screenshots/preview-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'Connection settings' }).click();
  await page.getByLabel('Prometheus subpath (optional)').fill('/../secrets');
  await page.getByRole('button', { name: 'Save connection' }).click();
  await expect(page.getByText(/optional path must contain/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'GPU Monitor' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'docs/screenshots/preview-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('distinguishes empty, denied, loading and stale data', async ({ page }) => {
  await page.goto('/');
  for (const [state, text] of [
    ['empty', 'No recent GPU metrics found.'],
    ['denied', 'Access denied.'],
    ['stale', 'Showing last successful readings; they are not current.'],
  ]) {
    await page.getByRole('combobox', { name: /Preview state/ }).click();
    await page.getByRole('option', { name: state, exact: true }).click();
    await expect(page.getByText(text, { exact: false })).toBeVisible();
  }
  await page.screenshot({ path: 'docs/screenshots/preview-stale.png', fullPage: true });
  await page.getByRole('combobox', { name: /Preview state/ }).click();
  await page.getByRole('option', { name: 'loading', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Loading GPU metrics' })).toBeVisible();
});
