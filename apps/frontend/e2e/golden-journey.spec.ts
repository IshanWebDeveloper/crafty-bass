import { test, expect, request } from '@playwright/test';
import path from 'node:path';

const authDir = path.join(__dirname, '.auth');
const homeownerState = path.join(authDir, 'homeowner.json');
const tradesmanState = path.join(authDir, 'tradesman.json');

// Drive the marketplace's core loop end-to-end against a live stack: a
// homeowner posts a job through the real form, a tradesman quotes (via the API,
// to avoid juggling two browser sessions), and the homeowner sees the quote and
// accepts it. The signed-in homeowner storage state is the default context.
test.use({ storageState: homeownerState });

test.describe.serial('Golden journey: post job → quote → accept', () => {
  let jobId = '';
  let quoteId = '';

  test('homeowner posts a job through the form', async ({ page }) => {
    await page.goto('/en/jobs/new');
    await page.locator('#title').fill('E2E leaking kitchen tap');
    await page
      .locator('#description')
      .fill(
        'The kitchen tap has been dripping for days and needs a new washer.',
      );
    await page.locator('button[type="submit"]').click();

    // The form redirects to the new job's detail page on success.
    await page.waitForURL(/\/en\/jobs\/[^/]+$/, { timeout: 30_000 });
    jobId = page.url().split('/').pop() ?? '';
    expect(jobId).not.toBe('');
  });

  test('tradesman quotes, homeowner sees the quote and accepts', async () => {
    const tradesman = await request.newContext({
      baseURL: 'http://localhost:3000',
      storageState: tradesmanState,
    });
    const quoteRes = await tradesman.post(`/api/v1/jobs/${jobId}/quotes`, {
      data: {
        lineItems: [
          { category: 'LABOUR', name: 'Labour', quantity: 1, unitPrice: 12000 },
        ],
      },
    });
    expect(quoteRes.ok()).toBeTruthy();
    quoteId = (await quoteRes.json()).id as string;
    await tradesman.dispose();
  });

  test('the quote is visible and acceptance assigns the job', async ({
    page,
  }) => {
    await page.goto(`/en/jobs/${jobId}`);
    // The quoted amount (12,000) renders on the detail page.
    await expect(page.getByText(/12[,.\s]?000/).first()).toBeVisible();

    const owner = await request.newContext({
      baseURL: 'http://localhost:3000',
      storageState: homeownerState,
    });
    const acceptRes = await owner.patch(`/api/v1/quotes/${quoteId}/accept`);
    expect(acceptRes.ok()).toBeTruthy();

    const jobRes = await owner.get(`/api/v1/jobs/${jobId}`);
    expect(((await jobRes.json()) as { status: string }).status).toBe(
      'ASSIGNED',
    );
    await owner.dispose();
  });
});
