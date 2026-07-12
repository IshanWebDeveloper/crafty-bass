import { request } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// Fixture accounts. The dev backend runs a live MX check on sign-up, so these
// use a real mail domain (gmail); the mailboxes are never read (autoSignIn is
// on and email verification is not required). Accounts are reused across runs —
// sign-up on first run, sign-in thereafter.
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const PASSWORD = 'Password123!';

const ACCOUNTS = [
  {
    email: 'crafty.e2e.homeowner@gmail.com',
    name: 'E2E Homeowner',
    file: 'homeowner.json',
  },
  {
    email: 'crafty.e2e.tradesman@gmail.com',
    name: 'E2E Tradesman',
    file: 'tradesman.json',
  },
];

async function ensureAccount(
  email: string,
  name: string,
  statePath: string,
): Promise<void> {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  const signUp = await ctx.post('/api/auth/sign-up/email', {
    data: {
      email,
      password: PASSWORD,
      name,
      privacyPolicyAcceptedAt: new Date().toISOString(),
    },
    failOnStatusCode: false,
  });
  if (!signUp.ok()) {
    // Already registered from a previous run → sign in instead.
    const signIn = await ctx.post('/api/auth/sign-in/email', {
      data: { email, password: PASSWORD },
      failOnStatusCode: false,
    });
    if (!signIn.ok()) {
      throw new Error(
        `Auth failed for ${email}: sign-up ${signUp.status()} / sign-in ${signIn.status()}`,
      );
    }
  }
  await ctx.storageState({ path: statePath });
  await ctx.dispose();
}

export default async function globalSetup(): Promise<void> {
  const authDir = path.join(__dirname, '.auth');
  mkdirSync(authDir, { recursive: true });
  for (const account of ACCOUNTS) {
    await ensureAccount(
      account.email,
      account.name,
      path.join(authDir, account.file),
    );
  }
}
