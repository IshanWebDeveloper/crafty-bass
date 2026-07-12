import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:3000';

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * The golden journey signs up/in through the Next origin proxy, so it runs
 * against a live backend + frontend. Both are booted below (reused if already
 * running). This suite is intentionally NOT wired into CI — it's a local /
 * manual gate; the dev backend uses the dev database and a live MX check on
 * sign-up emails (hence the gmail-domain fixtures in global-setup).
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './e2e' }),
  // Seed browser storage state (signed-in homeowner + tradesman) once.
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  // Boot the backend and frontend (only) for the run; reuse if already up.
  webServer: [
    {
      command: 'pnpm nx run backend:dev',
      url: 'http://localhost:3005/api/v1/health',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: 180_000,
    },
    {
      command: 'pnpm nx run frontend:dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: 180_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
