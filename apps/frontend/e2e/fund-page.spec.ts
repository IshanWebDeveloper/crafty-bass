import { test, expect, request } from '@playwright/test';

// Requires the dev database to have been seeded (`pnpm --filter @repo/db
// db:seed:users`). Gated so the default golden-journey run — which creates its
// own accounts — doesn't depend on seed data being present.
test.skip(
  !process.env.E2E_SEEDED,
  'Set E2E_SEEDED=1 (with a seeded dev DB) to run the fund-page spec.',
);

const BASE = 'http://localhost:3000';
const PASSWORD = 'Password123!';
// Seeded fixtures: anna is a homeowner, priya is a *verified* tradesman (the
// seed marks kasun unverified, so a materials deposit must come from priya).
const HOMEOWNER = 'anna@example.com';
const TRADESMAN = 'priya@example.com';

async function signedInContext(email: string) {
  const ctx = await request.newContext({ baseURL: BASE });
  const res = await ctx.post('/api/auth/sign-in/email', {
    data: { email, password: PASSWORD },
    failOnStatusCode: false,
  });
  if (!res.ok()) {
    throw new Error(`sign-in failed for ${email}: ${res.status()}`);
  }
  return ctx;
}

test('the fund page renders the deposit summary for an accepted deposit quote', async ({
  browser,
}) => {
  const homeowner = await signedInContext(HOMEOWNER);
  const tradesman = await signedInContext(TRADESMAN);

  // Homeowner posts a job.
  const jobRes = await homeowner.post('/api/v1/jobs', {
    data: {
      title: 'E2E deposit fund flow',
      description: 'Seeded flow that requires a materials deposit up front.',
    },
  });
  expect(jobRes.ok()).toBeTruthy();
  const jobId = (await jobRes.json()).id as string;

  // Verified tradesman quotes with a materials deposit.
  const quoteRes = await tradesman.post(`/api/v1/jobs/${jobId}/quotes`, {
    data: {
      lineItems: [
        { category: 'LABOUR', name: 'Labour', quantity: 1, unitPrice: 8000 },
        {
          category: 'MATERIAL',
          name: 'Materials',
          quantity: 1,
          unitPrice: 6000,
        },
      ],
      depositRequested: 2000,
    },
  });
  expect(quoteRes.ok()).toBeTruthy();
  const quoteId = (await quoteRes.json()).id as string;

  // Homeowner accepts → escrow is created.
  const acceptRes = await homeowner.patch(`/api/v1/quotes/${quoteId}/accept`);
  expect(acceptRes.ok()).toBeTruthy();

  // Load the fund page in a signed-in homeowner browser session.
  const state = await homeowner.storageState();
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  await page.goto(`${BASE}/en/jobs/${jobId}/fund`);
  await expect(page.getByText(/deposit/i).first()).toBeVisible();

  await context.close();
  await homeowner.dispose();
  await tradesman.dispose();
});
