// The dev-only seed script (packages/db/prisma/seed-users.ts) dynamically
// imports @repo/auth, creating a build-time @repo/db -> @repo/auth edge that is
// silenced there. That makes the essential @repo/auth -> @repo/db import below a
// cycle at the Nx graph level; silence the matching edge here too so linting the
// auth project doesn't re-flag the same intentional dev-time cycle.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { prisma } from '@repo/db';
import { APIError, betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import {
  admin,
  openAPI,
  bearer,
  jwt,
  phoneNumber,
  emailOTP,
} from 'better-auth/plugins';
import {
  ac,
  admin as adminRole,
  customer as customerRole,
  support as supportRole,
} from './access.js';
// Re-export the access-control statements so the backend RBAC types import them
// from @repo/auth alongside the auth instance.
export { statements } from './access.js';
import { stripe } from '@better-auth/stripe';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { hasValidMxRecords } from './email-validation.js';
import { escapeHtml } from './escape-html.js';

const defaultPort = process.env.PORT ?? '3005';
const baseURL =
  process.env.BETTER_AUTH_URL ?? `http://localhost:${defaultPort}`;
const secret = process.env.BETTER_AUTH_SECRET;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Configure Resend if API key is available
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : undefined;
const emailFrom =
  process.env.RESEND_FROM_EMAIL ?? 'Crafty Bass <onboarding@resend.dev>';

// Only initialise Stripe if keys are configured
const stripeClient = stripeSecretKey ? new Stripe(stripeSecretKey) : undefined;

const frontendURL = process.env.FRONTEND_URL ?? 'http://localhost:3000';

// Dev-only fixed OTP so seeded/test accounts can sign in without reading the
// console. Disabled in production (see verifyOTP wiring below). Override with
// DEV_PHONE_OTP.
const isProduction = process.env.NODE_ENV === 'production';
const devPhoneOtp = process.env.DEV_PHONE_OTP ?? '123456';
// Mirror of the phone dev OTP for the email-recovery flow, so seeded/test
// accounts can recover access without reading an inbox. Override with
// DEV_EMAIL_OTP; never used in production (the generateOTP override below is
// only wired in non-prod).
const devEmailOtp = process.env.DEV_EMAIL_OTP ?? devPhoneOtp;

const parseSeconds = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const sessionExpiresIn = parseSeconds(
  process.env.BETTER_AUTH_SESSION_EXPIRES_IN,
  60 * 60 * 24 * 30, // 30 days
);
const adminSessionExpiresIn = parseSeconds(
  process.env.BETTER_AUTH_ADMIN_SESSION_EXPIRES_IN,
  60 * 60 * 24, // 1 day
);

const PRIVACY_POLICY_VERSION = '2026-03-31';

const jwtIssuer = process.env.JWT_ISSUER ?? baseURL;
const jwtAudience = process.env.JWT_AUDIENCE ?? 'ai-service';

const plugins = [
  admin({
    ac,
    roles: {
      CUSTOMER: customerRole,
      SUPPORT: supportRole,
      ADMIN: adminRole,
    },
    defaultRole: 'CUSTOMER',
  }),
  openAPI(),
  bearer(),
  jwt({
    jwt: {
      issuer: jwtIssuer,
      audience: jwtAudience,
    },
  }),
  phoneNumber({
    otpLength: 6,
    expiresIn: 300, // 5 minutes
    // Phone is the primary credential for the marketplace. In dev we log the
    // code; wire an SMS provider (e.g. Notify.lk / Twilio) for production.
    sendOTP: async ({ phoneNumber: to, code }) => {
      if (!isProduction) {
        console.log(
          `[DEV] Crafty Bass OTP for ${to}: ${code} (or use static ${devPhoneOtp})`,
        );
        return;
      }
      // TODO: integrate an SMS provider here.
      console.warn(
        '⚠️ No SMS provider configured — phone OTP not sent in production.',
      );
    },
    // Dev only: accept a fixed OTP (or the real one) so seeded accounts are
    // trivial to test. Omitted in production, so the plugin's built-in
    // attempt-limited verification stays in force there.
    ...(isProduction
      ? {}
      : {
          verifyOTP: async ({ phoneNumber: to, code }, ctx) => {
            if (code === devPhoneOtp) return true;
            const stored =
              await ctx?.context.internalAdapter.findVerificationValue(to);
            if (!stored || stored.expiresAt < new Date()) return false;
            return stored.value.split(':')[0] === code;
          },
        }),
    // Verifying an OTP for an unknown number creates the account. The sign-up
    // form then patches the real name + recovery email onto it.
    signUpOnVerification: {
      getTempEmail: (phone) =>
        `${phone.replace(/[^\d]/g, '')}@phone.craftybass.lk`,
      getTempName: (phone) => phone,
    },
  }),
  // Account recovery: phone is the primary credential, so a tradesman who
  // loses their number signs back in with a one-time code emailed to the
  // recovery address they set at sign-up. `disableSignUp` makes this strictly
  // a recovery path — an unknown email is rejected rather than silently
  // creating a new account.
  emailOTP({
    otpLength: 6,
    expiresIn: 300, // 5 minutes
    disableSignUp: true,
    // Dev only: accept a fixed code so seeded accounts recover without reading
    // the inbox (mirrors the phone OTP). Omitted in production, where a random
    // code is generated and the plugin's attempt-limited verification applies.
    ...(isProduction ? {} : { generateOTP: () => devEmailOtp }),
    sendVerificationOTP: async ({ email, otp, type }) => {
      if (!isProduction) {
        console.log(
          `[DEV] Crafty Bass email OTP (${type}) for ${email}: ${otp} (or use static ${devEmailOtp})`,
        );
      }
      if (!resend) {
        console.warn(
          '⚠️ RESEND_API_KEY not configured — recovery code email not sent.',
        );
        return;
      }
      const safeOtp = escapeHtml(otp);
      await resend.emails.send({
        to: email,
        from: emailFrom,
        subject: 'Your Crafty Bass sign-in code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Sign back in to Crafty Bass</h2>
            <p>Use this code to recover access to your account:</p>
            <p style="text-align: center; margin: 32px 0;">
              <span style="display: inline-block; background-color: #f1f5f9; color: #0f172a; padding: 12px 24px; border-radius: 6px; font-size: 28px; font-weight: 700; letter-spacing: 6px;">
                ${safeOtp}
              </span>
            </p>
            <p style="color: #64748b; font-size: 14px;">This code expires in 5 minutes. If you didn't request it, you can safely ignore this email.</p>
          </div>
        `,
      });
    },
  }),
  ...(stripeClient && stripeWebhookSecret
    ? [
        stripe({
          stripeClient,
          successUrl: `${frontendURL}/success`,
          subscription: {
            enabled: false,
          },
          stripeWebhookSecret,
          createCustomerOnSignUp: true,
        }),
      ]
    : []),
];

export const auth = betterAuth({
  baseURL,
  secret,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  user: {
    changeEmail: {
      enabled: true,
      // better-auth applies the change directly when the *current* email is
      // unverified (the case for phone sign-up's temp `…@phone.craftybass.lk`
      // address), so the recovery email entered at sign-up is set immediately.
      // This handler only fires when changing away from an already-verified
      // address: it emails an approval link to the current address.
      sendChangeEmailVerification: async ({ user, newEmail, url }) => {
        if (!resend) {
          console.warn(
            '⚠️ RESEND_API_KEY not configured — change-email verification not sent.',
          );
          return;
        }
        if (process.env.NODE_ENV !== 'production') {
          console.log(
            `[DEV] Change-email approval URL for ${user.email} → ${newEmail}: ${url}`,
          );
        }
        const safeName = escapeHtml(user.name);
        const safeUrl = escapeHtml(url);
        const safeNewEmail = escapeHtml(newEmail);
        await resend.emails.send({
          to: user.email,
          from: emailFrom,
          subject: 'Approve your email change — Crafty Bass',
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Confirm your new email address</h2>
            <p>Hi ${safeName},</p>
            <p>We received a request to change your account email to <strong>${safeNewEmail}</strong>. Click the button below to approve it:</p>
            <p style="text-align: center; margin: 32px 0;">
              <a href="${safeUrl}" style="background-color: #0f172a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                Approve email change
              </a>
            </p>
            <p style="color: #64748b; font-size: 14px;">If you didn't request this, you can safely ignore this email and your address won't change.</p>
          </div>
        `,
        });
      },
    },
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'CUSTOMER',
        input: false,
      },
      userType: {
        // Marketplace role (HOMEOWNER | TRADESMAN) — a domain column owned by
        // @repo/db, surfaced through better-auth so it rides in the session.
        // This is what lets server guards read it from get-session
        // (lib/server-session.ts) and lets the sign-up form persist the chosen
        // role via updateUser. `required: false` — it stays null until the user
        // commits to a role (the backend also sets it lazily on the first
        // job/quote, and definitively when a profile is created).
        type: 'string',
        required: false,
        input: true,
      },
      phone: {
        type: 'string',
        required: false,
      },
      stripeCustomerId: {
        type: 'string',
        required: false,
      },
      deletionScheduledAt: {
        type: 'date',
        required: false,
      },
      privacyPolicyAcceptedAt: {
        // Not `required` at the API-input layer: phone sign-up
        // (signUpOnVerification) never supplies it, and better-auth enforces
        // required additionalFields *before* databaseHooks run — which would
        // reject the verify call before the create hook below can default it.
        // The DB column stays NOT NULL; the user.create.before hook guarantees
        // a value on both the phone path (defaulted) and /sign-up/email
        // (validated + rejected if missing).
        type: 'date',
        required: false,
      },
    },
  },
  session: {
    expiresIn: sessionExpiresIn,
    updateAge: 60 * 60, // Refresh the active session every hour
    freshAge: 60 * 60, // 1 hour in seconds
    cookieCache: {
      enabled: true,
      strategy: 'jwt',
      maxAge: 60 * 5, // 5 minutes
    },
  },
  rateLimit: {
    windowMs: 60_000, // 1 minute
    // Limit auth-related requests to 10 per minute in non-dev environments
    max: process.env.NODE_ENV === 'development' ? Infinity : 10,
    standardHeaders: 'draft-7', // Sets RateLimit-* and Retry-After headers
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 3600, // 1 hour in seconds
    sendResetPassword: async ({ user, token }) => {
      if (!resend) {
        console.warn(
          '⚠️ RESEND_API_KEY not configured — password reset email not sent.',
        );
        return;
      }
      const resetLink = `${frontendURL}/reset-password?token=${encodeURIComponent(token)}`;
      const safeName = escapeHtml(user.name);
      const safeResetLink = escapeHtml(resetLink);
      await resend.emails.send({
        to: user.email,
        from: emailFrom,
        subject: 'Reset Your Password — Crafty Bass',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>Hi ${safeName},</p>
            <p>We received a request to reset your password. Click the button below to choose a new one:</p>
            <p style="text-align: center; margin: 32px 0;">
              <a href="${safeResetLink}" style="background-color: #0f172a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                Reset Password
              </a>
            </p>
            <p style="color: #64748b; font-size: 14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,

    sendVerificationEmail: async ({ user, token }) => {
      if (!resend) {
        console.warn(
          '⚠️ RESEND_API_KEY not configured — verification email not sent.',
        );
        return;
      }
      const verificationLink = `${frontendURL}/verify-email?token=${encodeURIComponent(token)}`;
      // Log the URL in development for easy local testing
      if (process.env.NODE_ENV !== 'production') {
        console.log(
          `[DEV] Verification URL for ${user.email}: ${verificationLink}`,
        );
      }
      const safeName = escapeHtml(user.name);
      const safeVerificationLink = escapeHtml(verificationLink);
      await resend.emails.send({
        to: user.email,
        from: emailFrom,
        subject: 'Verify Your Email — Crafty Bass',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Verify your email address</h2>
            <p>Hi ${safeName},</p>
            <p>Thanks for creating an account! Please click the button below to verify your email address:</p>
            <p style="text-align: center; margin: 32px 0;">
              <a href="${safeVerificationLink}" style="background-color: #0f172a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                Verify Email
              </a>
            </p>
            <p style="color: #64748b; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
          </div>
        `,
      });
    },
  },
  trustedOrigins: [
    baseURL,
    ...(process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? []),
  ],

  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.update({
            where: { id: session.userId },
            data: { deletionScheduledAt: null },
            select: { role: true },
          });

          if (user.role !== 'ADMIN' && user.role !== 'SUPPORT') {
            return { data: session };
          }

          // Keep admin/support sessions short-lived regardless of remember-me choice.
          const expiresAt = new Date(Date.now() + adminSessionExpiresIn * 1000);

          return {
            data: {
              ...session,
              expiresAt,
            },
          };
        },
      },
    },
    user: {
      create: {
        before: async (user, context) => {
          // Phone sign-up (the phoneNumber plugin) creates the user outside the
          // /sign-up/email path, so the required privacyPolicyAcceptedAt isn't
          // supplied. The sign-up form gates on consent before sending the OTP,
          // so default it here to satisfy the NOT NULL column.
          if (
            context?.path !== '/sign-up/email' &&
            !(user as { privacyPolicyAcceptedAt?: unknown })
              .privacyPolicyAcceptedAt
          ) {
            (
              user as { privacyPolicyAcceptedAt?: Date }
            ).privacyPolicyAcceptedAt = new Date();
          }

          if (context?.path === '/sign-up/email') {
            const acceptedAtRaw = (
              user as { privacyPolicyAcceptedAt?: unknown }
            ).privacyPolicyAcceptedAt;

            const acceptedAt =
              acceptedAtRaw instanceof Date
                ? acceptedAtRaw
                : typeof acceptedAtRaw === 'string'
                  ? new Date(acceptedAtRaw)
                  : null;

            if (!acceptedAt || Number.isNaN(acceptedAt.getTime())) {
              throw new APIError('UNPROCESSABLE_ENTITY', {
                message: 'Privacy policy acceptance is required.',
              });
            }

            (
              user as { privacyPolicyAcceptedAt?: Date }
            ).privacyPolicyAcceptedAt = acceptedAt;
          }

          if (
            context?.path !== '/sign-up/email' ||
            typeof user.email !== 'string' ||
            process.env.NODE_ENV === 'test' ||
            (await hasValidMxRecords(user.email))
          ) {
            return;
          }

          throw new APIError('UNPROCESSABLE_ENTITY', {
            message: "The Domain doesn't have valid Email service.",
          });
        },
        after: async (user) => {
          const acceptedAt = (user as { privacyPolicyAcceptedAt?: Date })
            .privacyPolicyAcceptedAt;

          if (!acceptedAt) {
            return;
          }

          await prisma.userConsent.upsert({
            where: {
              userId_consentType: {
                userId: user.id,
                consentType: 'privacy_policy',
              },
            },
            create: {
              userId: user.id,
              consentType: 'privacy_policy',
              granted: true,
              grantedAt: acceptedAt,
              consentVersion: PRIVACY_POLICY_VERSION,
            },
            update: {
              granted: true,
              revokedAt: null,
              grantedAt: acceptedAt,
              consentVersion: PRIVACY_POLICY_VERSION,
            },
          });
        },
      },
      update: {
        before: async (data, context) => {
          // Set-once guard: userType may be assigned while it's still null (at
          // sign-up, or lazily on the first job/quote), but never changed
          // afterwards — otherwise a homeowner could flip to TRADESMAN (or vice
          // versa) via updateUser and slip past the role checks. Only runs when
          // an update actually touches userType, so ordinary profile edits
          // (name, etc.) pay no extra query.
          if (!('userType' in data)) return;
          const userId = (
            context as {
              context?: { session?: { user?: { id?: string } } };
            } | null
          )?.context?.session?.user?.id;
          if (!userId) return;
          const existing = await prisma.user.findUnique({
            where: { id: userId },
            select: { userType: true },
          });
          if (existing?.userType && existing.userType !== data.userType) {
            throw new APIError('FORBIDDEN', {
              message: 'Your account role cannot be changed once it is set.',
            });
          }
        },
      },
    },
  },
  advanced: {
    // Fail safe: CSRF is enforced unless `DISABLE_CSRF_CHECK=true` is explicitly
    // set. Prior behaviour keyed off NODE_ENV, which silently disabled CSRF
    // anywhere NODE_ENV was unset (a common production misconfiguration).
    disableCSRFCheck: process.env.DISABLE_CSRF_CHECK === 'true',
    useSecureCookies: process.env.NODE_ENV === 'production',
    defaultCookieAttributes: {
      // Lax is a sensible default; set to 'none' if you need cross-site cookies in production
      sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: `${baseURL}/api/auth/callback/google`,
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
    },
  },

  plugins,
});
