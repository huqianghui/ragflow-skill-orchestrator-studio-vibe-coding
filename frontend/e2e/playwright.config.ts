import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: '.',
  timeout: 30000,
  retries: isCI ? 1 : 0,
  reporter: isCI
    ? [['html', { outputFolder: '../playwright-report' }], ['github']]
    : [['list']],
  use: {
    baseURL: 'http://localhost:15173',
    headless: true,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 15173,
    cwd: '..',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
