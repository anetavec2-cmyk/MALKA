import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8091',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], permissions: ['camera'], launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } } }],
  webServer: {
    command: 'npm run build:web && npx expo serve --port 8091',
    url: 'http://localhost:8091',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
