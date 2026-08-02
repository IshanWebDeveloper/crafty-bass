import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:3000';

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * The golden journey signs up/in through the Next origin proxy, so it runs
 * against a live backend + frontend. The backend, frontend and AI service are
 * all booted below (reused if already running). This suite is intentionally NOT
 * wired into CI — it's a local / manual gate; the dev backend uses the dev
 * database and a live MX check on sign-up emails (hence the gmail-domain
 * fixtures in global-setup), and the classify step asserts a real prediction so
 * the dev DB must be seeded with a service catalog and the AI service needs an
 * LLM provider key configured (apps/ai-service/.env) for its target to boot.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './e2e' }),
  // Seed browser storage state (signed-in homeowner + tradesman) once.
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'on-first-retry',
    // Capture a screenshot at the end of every test that drives a page, so the
    // HTML report doubles as visual evidence of the run.
    screenshot: 'on',
  },
  // Boot the backend, frontend and AI service for the run; reuse if already up.
  // Probe on 127.0.0.1 (not localhost): the AI service binds IPv4 only, and on
  // Windows `localhost` resolves to IPv6 (::1) first, so a localhost probe never
  // sees it — which also makes Playwright spawn duplicate dev servers that race
  // on the same build output.
  webServer: [
    {
      command: 'pnpm nx run backend:dev',
      // Health is mounted at /health (excluded from the api/v1 global prefix).
      url: 'http://127.0.0.1:3005/health',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: 180_000,
    },
    {
      command: 'pnpm nx run frontend:dev',
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: true,
      cwd: workspaceRoot,
      timeout: 180_000,
    },
    {
      // Powers the classify step; the Nx target runs the venv uvicorn on 8006
      // (the venv must exist — see the AI service setup in the root CLAUDE.md).
      command: 'pnpm nx run ai-service:dev',
      url: 'http://127.0.0.1:8006/api/v1/health',
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
