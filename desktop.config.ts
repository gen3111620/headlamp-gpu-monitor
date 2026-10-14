import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.desktop.ts',
  workers: 1,
  timeout: 120000,
  use: { trace: 'off' },
});
