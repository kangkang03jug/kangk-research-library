import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    command: 'npm run dev -- --host 0.0.0.0 --port 4321',
    url: 'http://127.0.0.1:4321/',
    timeout: 120_000,
    reuseExistingServer: false,
    env: { ASTRO_DEV_BACKGROUND: '0' },
  },
  use: { baseURL: 'http://127.0.0.1:4321', ...devices['Desktop Chrome'] },
});
