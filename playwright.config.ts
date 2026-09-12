import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: true,
    env: { ASTRO_DEV_BACKGROUND: '1' },
  },
  use: { baseURL: 'http://127.0.0.1:4321', ...devices['Desktop Chrome'] },
});
