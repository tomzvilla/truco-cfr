import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: { baseURL: 'http://localhost:4190/truco-cfr/' },
  webServer: { command: 'node e2e/serve.ts', url: 'http://localhost:4190/truco-cfr/', reuseExistingServer: false },
  projects: [
    { name: 'celular', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } } },
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
  ],
});
