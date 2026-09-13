import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    command: 'npm run build && node scripts/serve-dist.mjs',
    url: 'http://127.0.0.1:4321/',
    timeout: 120_000,
    reuseExistingServer: false,
    env: { PORT: '4321' },
  },
  use: { baseURL: 'http://127.0.0.1:4321', ...devices['Desktop Chrome'] },
});
