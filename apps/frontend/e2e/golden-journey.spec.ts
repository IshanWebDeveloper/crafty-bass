import {
  test,
  expect,
  request,
  type APIRequestContext,
} from '@playwright/test';
import path from 'node:path';

const authDir = path.join(__dirname, '.auth');
const homeownerState = path.join(authDir, 'homeowner.json');
const tradesmanState = path.join(authDir, 'tradesman.json');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Seeded staff account (packages/db/prisma/seed-users.ts) used to approve the
// fixture tradesman's verification.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Password123!';

// A signed-in API context for one of the fixture accounts. Most steps drive the
// backend directly (via the Next proxy) to avoid juggling two browser sessions;
// the UI assertions run in the default homeowner page context (test.use below).
function ctxFor(state: string): Promise<APIRequestContext> {
  return request.newContext({ baseURL: BASE_URL, storageState: state });
}

// Drive the marketplace's full core loop end-to-end against a live stack:
//
//   homeowner: post → classify → recommend → accept → fund → complete → review
//   tradesman: browse → quote → complete → review
//
// The signed-in homeowner storage state is the default page context.
test.use({ storageState: homeownerState });

test.describe
  .serial('Golden journey: post → classify → recommend → accept → fund → complete → review', () => {
  let jobId = '';
  let quoteId = '';
  let escrowId = '';
  let tradesmanId = '';

  // The recommendation engine only ranks tradesmen who have an available
  // tradesman profile, so make the E2E tradesman a real candidate (and capture
  // their id) before the homeowner asks for recommendations. Idempotent upsert
  // — safe to re-run against the reused fixture account.
  test.beforeAll(async () => {
    const tradesman = await ctxFor(tradesmanState);

    // Quoting is gated on an approved verification (QuotesService.create), so
    // the fixture tradesman has to clear it before the quote step below. Both
    // submit and approve 409 once approved, so this only runs on the first pass
    // against a fresh account - afterwards the account is already APPROVED.
    const mine = await tradesman.get('/api/v1/verification/me');
    const status = mine.ok()
      ? ((await mine.json()) as { status?: string } | null)?.status
      : undefined;

    if (status !== 'APPROVED') {
      const submitted = await tradesman.post('/api/v1/verification', {
        data: {
          fullName: 'E2E Tradesman',
          nicNumber: '990000000V',
          city: 'Colombo',
          district: 'Colombo',
          primaryTrade: 'Plumbing',
          yearsExperience: 6,
        },
      });
      expect(submitted.ok()).toBeTruthy();
      const submissionId = ((await submitted.json()) as { id: string }).id;

      // Approval is a reviewer action, so it needs a staff session. The seeded
      // admin signs in with email + password (better-auth core).
      const admin = await request.newContext({ baseURL: BASE_URL });
      const signedIn = await admin.post('/api/auth/sign-in/email', {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      });
      expect(
        signedIn.ok(),
        `admin sign-in failed - is the dev database seeded (pnpm --filter @repo/db db:seed:users)?`,
      ).toBeTruthy();

      const approved = await admin.post(
        `/api/v1/verification/${submissionId}/approve`,
      );
      expect(approved.ok()).toBeTruthy();
      await admin.dispose();
    }

    const res = await tradesman.put('/api/v1/profiles/me/tradesman', {
      data: { yearsExperience: 6, city: 'Colombo', district: 'Colombo' },
    });
    expect(res.ok()).toBeTruthy();
    tradesmanId = ((await res.json()) as { userId: string }).userId;
    await tradesman.dispose();
  });

  test('homeowner posts a job through the form', async ({ page }) => {
    await page.goto('/en/jobs/new');
    await page.locator('#title').fill('E2E leaking kitchen tap');
    await page
      .locator('#description')
      .fill(
        'The kitchen tap has been dripping for days and needs a new washer.',
      );

    // The form debounces a call to the classifier (which proxies to the AI
    // service) and renders the suggestion inline: a "Detected <category>" panel
    // with a confidence badge. Assert it appears through the UI before
    // submitting, so classification is exercised end-to-end from the form and
    // not only via the direct API call below. Generous timeout: it waits on a
    // live model round-trip.
    await expect(page.getByText(/Detected/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/% confidence/i).first()).toBeVisible();

    await page.locator('button[type="submit"]').click();

    // The form redirects to the new job's detail page on success. The negative
    // lookahead excludes the /jobs/new form URL itself — otherwise the wait
    // resolves immediately against the page we're already on and captures a
    // 'new' job id instead of the real one.
    await page.waitForURL(/\/en\/jobs\/(?!new$)[^/]+$/, { timeout: 30_000 });
    jobId = page.url().split('/').pop() ?? '';
    expect(jobId).not.toBe('');
    expect(jobId).not.toBe('new');
  });

  test('the classifier suggests a category and skills for the draft', async () => {
    const owner = await ctxFor(homeownerState);
    // Classification proxies to the AI service (booted by playwright.config's
    // webServer), which classifies against the live catalog — so this asserts a
    // real prediction and requires the dev DB to be seeded with categories.
    const res = await owner.post('/api/v1/classify/job', {
      data: {
        title: 'E2E leaking kitchen tap',
        description:
          'The kitchen tap has been dripping for days and needs a new washer.',
        language: 'EN',
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      category: { id: string; slug: string; nameEn: string } | null;
      skills: unknown[];
      confidence: number;
      model: string;
    };
    // A tap-repair description maps to a real catalog category (not the empty
    // 'none' prediction the service returns when no taxonomy is available).
    expect(body.category).not.toBeNull();
    expect(body.model).not.toBe('none');
    expect(Array.isArray(body.skills)).toBeTruthy();
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(1);
    await owner.dispose();
  });

  test('the owner sees ranked recommended tradespeople on the open job', async ({
    page,
  }) => {
    // The RecommendedTradesmen panel renders for the owner while the job is OPEN.
    await page.goto(`/en/jobs/${jobId}`);
    await expect(page.getByText('Recommended tradespeople')).toBeVisible();

    // The engine scores available tradesmen and persists JobRecommendation
    // rows; the API returns them best-rank-first, joined with a tradesman
    // summary. The E2E tradesman (now an available candidate) is among them.
    const owner = await ctxFor(homeownerState);
    const recRes = await owner.get(`/api/v1/recommendations/jobs/${jobId}`);
    expect(recRes.ok()).toBeTruthy();
    const recs = (await recRes.json()) as Array<{
      rank: number;
      tradesmanId: string;
      reasons: unknown;
    }>;
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].rank).toBe(1);
    expect(recs.some((r) => r.tradesmanId === tradesmanId)).toBeTruthy();
    await owner.dispose();
  });

  test('tradesman browses open jobs and quotes on this one', async () => {
    const tradesman = await ctxFor(tradesmanState);

    // Browse the public open-jobs board and confirm the freshly posted job is
    // listed there for tradesmen to find.
    const browseRes = await tradesman.get('/api/v1/jobs?limit=60');
    expect(browseRes.ok()).toBeTruthy();
    const board = (await browseRes.json()) as {
      data: Array<{ id: string }>;
    };
    expect(board.data.some((j) => j.id === jobId)).toBeTruthy();

    const quoteRes = await tradesman.post(`/api/v1/jobs/${jobId}/quotes`, {
      data: {
        lineItems: [
          {
            category: 'LABOUR',
            name: 'Labour',
            quantity: 1,
            unitPrice: 12000,
          },
        ],
      },
    });
    expect(quoteRes.ok()).toBeTruthy();
    quoteId = ((await quoteRes.json()) as { id: string }).id;
    await tradesman.dispose();
  });

  test('the quote is visible and acceptance assigns the job', async ({
    page,
  }) => {
    await page.goto(`/en/jobs/${jobId}`);
    // The quoted amount (12,000) renders on the detail page.
    await expect(page.getByText(/12[,.\s]?000/).first()).toBeVisible();

    const owner = await ctxFor(homeownerState);
    const acceptRes = await owner.patch(`/api/v1/quotes/${quoteId}/accept`);
    expect(acceptRes.ok()).toBeTruthy();

    const jobRes = await owner.get(`/api/v1/jobs/${jobId}`);
    expect(((await jobRes.json()) as { status: string }).status).toBe(
      'ASSIGNED',
    );
    await owner.dispose();
  });

  test('homeowner funds the pay-to-start deposit into escrow', async () => {
    const owner = await ctxFor(homeownerState);

    // Accepting the quote created a REQUESTED escrow (every accepted quote gets
    // a pay-to-start step).
    const escrowRes = await owner.get(`/api/v1/jobs/${jobId}/escrow`);
    expect(escrowRes.ok()).toBeTruthy();
    const escrow = (await escrowRes.json()) as {
      id: string;
      status: string;
    };
    escrowId = escrow.id;
    expect(escrow.status).toBe('REQUESTED');

    // Fund via the simulated 'local' method so the flow doesn't need Stripe.
    const fundRes = await owner.post(`/api/v1/escrows/${escrowId}/fund`, {
      data: { paymentMethod: 'local' },
    });
    expect(fundRes.ok()).toBeTruthy();
    expect(((await fundRes.json()) as { status: string }).status).toBe(
      'FUNDED',
    );
    await owner.dispose();
  });

  test('tradesman starts and completes the work', async () => {
    const tradesman = await ctxFor(tradesmanState);

    // Start work → deposit released to the tradesman, job IN_PROGRESS.
    const releaseRes = await tradesman.post(
      `/api/v1/escrows/${escrowId}/release-materials`,
    );
    expect(releaseRes.ok()).toBeTruthy();
    expect(((await releaseRes.json()) as { status: string }).status).toBe(
      'MATERIALS_RELEASED',
    );

    // Mark the work finished → awaits homeowner approval.
    const doneRes = await tradesman.post(
      `/api/v1/escrows/${escrowId}/work-done`,
    );
    expect(doneRes.ok()).toBeTruthy();
    expect(((await doneRes.json()) as { status: string }).status).toBe(
      'WORK_COMPLETED',
    );
    await tradesman.dispose();
  });

  test('homeowner approves the work, releasing the balance and completing the job', async () => {
    const owner = await ctxFor(homeownerState);
    const approveRes = await owner.post(`/api/v1/escrows/${escrowId}/approve`);
    expect(approveRes.ok()).toBeTruthy();
    expect(((await approveRes.json()) as { status: string }).status).toBe(
      'RELEASED',
    );

    const jobRes = await owner.get(`/api/v1/jobs/${jobId}`);
    expect(((await jobRes.json()) as { status: string }).status).toBe(
      'COMPLETED',
    );
    await owner.dispose();
  });

  test('both parties review the completed job', async () => {
    // Homeowner reviews the tradesman.
    const owner = await ctxFor(homeownerState);
    const ownerReview = await owner.post(`/api/v1/jobs/${jobId}/reviews`, {
      data: {
        rating: 5,
        title: 'Great work',
        comment: 'Fixed the leaking tap quickly and tidily.',
      },
    });
    expect(ownerReview.ok()).toBeTruthy();
    await owner.dispose();

    // Tradesman reviews the homeowner.
    const tradesman = await ctxFor(tradesmanState);
    const tradesmanReview = await tradesman.post(
      `/api/v1/jobs/${jobId}/reviews`,
      { data: { rating: 5, comment: 'Clear brief and prompt payment.' } },
    );
    expect(tradesmanReview.ok()).toBeTruthy();
    await tradesman.dispose();

    // Both reviews are public on the job's reviews list.
    const anon = await request.newContext({ baseURL: BASE_URL });
    const listRes = await anon.get(`/api/v1/jobs/${jobId}/reviews`);
    expect(listRes.ok()).toBeTruthy();
    const list = (await listRes.json()) as { data: unknown[] };
    expect(list.data.length).toBeGreaterThanOrEqual(2);
    await anon.dispose();
  });
});
