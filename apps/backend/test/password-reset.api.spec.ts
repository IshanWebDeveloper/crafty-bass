import { test, expect } from '@playwright/test';
import { PrismaClient, createDbAdapter } from '@repo/db';

test.describe('Backend API: Password Reset Flow', () => {
  let prisma: PrismaClient;
  const testEmail = 'api-test-reset@example.com';
  const testPassword = 'Password123!';
  const apiBase = 'http://127.0.0.1:3005/api/auth';

  test.beforeAll(async () => {
    // We connect to the real dev DB used by the running backend
    prisma = new PrismaClient({ adapter: createDbAdapter() });

    // Clean up previous test users if any
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
  });

  test.afterAll(async () => {
    // Clean up
    const user = await prisma.user.findFirst({
      where: { email: testEmail },
    });

    if (user) {
      await prisma.verification.deleteMany({
        where: { identifier: testEmail },
      });
      await prisma.user.deleteMany({
        where: { email: testEmail },
      });
    }

    await prisma.$disconnect();
  });

  test('POST /api/auth/forget-password — succeeds for existing user', async ({
    request,
  }) => {
    // 1. Register a real user to test against via the API
    const signupRes = await request.post(`${apiBase}/sign-up/email`, {
      data: {
        email: testEmail,
        password: testPassword,
        name: 'API Test User',
      },
    });

    expect(signupRes.ok()).toBeTruthy();

    // 2. Request a password reset
    const forgetRes = await request.post(`${apiBase}/request-password-reset`, {
      data: {
        email: testEmail,
        redirectTo: 'http://localhost:3000/reset-password',
      },
    });

    if (!forgetRes.ok()) {
      console.log(
        'Forget Password failed:',
        forgetRes.status(),
        await forgetRes.text(),
      );
    }
    expect(forgetRes.ok()).toBeTruthy();
    const forgetBody = (await forgetRes.json()) as { status: boolean };
    expect(forgetBody.status).toBe(true);

    // 3. Verify a token was saved in the DB
    const user = await prisma.user.findFirst({ where: { email: testEmail } });
    expect(user).toBeDefined();

    const verification = await prisma.verification.findFirst({
      where: { value: user?.id, identifier: { startsWith: 'reset-password:' } },
      orderBy: { createdAt: 'desc' },
    });
    expect(verification).toBeDefined();
    expect(verification?.identifier).toBeDefined();
  });

  test('POST /api/auth/reset-password — succeeds with valid token', async ({
    request,
  }) => {
    // Find the token generated in the previous test
    const user = await prisma.user.findFirst({ where: { email: testEmail } });
    const verification = await prisma.verification.findFirst({
      where: { value: user?.id, identifier: { startsWith: 'reset-password:' } },
      orderBy: { createdAt: 'desc' },
    });

    expect(verification).toBeDefined();

    // The token is everything after "reset-password:"
    const token = verification?.identifier.split(':')[1];

    // 4. Reset the password using the generated token
    const newPassword = 'NewPassword123!';
    const resetRes = await request.post(`${apiBase}/reset-password`, {
      data: {
        newPassword,
        token,
      },
    });

    if (!resetRes.ok()) {
      console.log(
        'Reset Password failed:',
        resetRes.status(),
        await resetRes.text(),
      );
    }
    expect(resetRes.ok()).toBeTruthy();

    // 5. Verify the user can log in with the NEW password
    const loginRes = await request.post(`${apiBase}/sign-in/email`, {
      data: {
        email: testEmail,
        password: newPassword,
      },
    });

    expect(loginRes.ok()).toBeTruthy();
    const loginBody = (await loginRes.json()) as { user: unknown };
    expect(loginBody.user).toBeDefined();
  });

  test('POST /api/auth/reset-password — fails with invalid token', async ({
    request,
  }) => {
    const resetRes = await request.post(`${apiBase}/reset-password`, {
      data: {
        newPassword: 'NewPassword123!',
        token: 'invalid-or-fake-token',
      },
    });

    // Should return 4xx error
    expect(resetRes.ok()).toBeFalsy();
    expect([400, 401, 403]).toContain(resetRes.status());
  });
});
