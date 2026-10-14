import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['tests/promql.test.ts'], testTimeout: 30000 },
});
