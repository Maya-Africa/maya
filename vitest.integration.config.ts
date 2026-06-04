/**
 * Vitest config for Commerce integration tests.
 * Runs against real DB, real CoinGecko, real Breez, real Bitnob sandbox, real Nostr.
 * No mocks.
 *
 * Run: npx vitest run --config vitest.integration.config.ts
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/integration-setup.ts'],
    testTimeout: 30_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
