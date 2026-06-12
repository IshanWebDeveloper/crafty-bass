import { PrismaClient } from '@repo/db';
import { APIError, betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin, openAPI, bearer, jwt } from 'better-auth/plugins';
import {
  ac,
  admin as adminRole,
  customer as customerRole,
  support as supportRole,
} from './auth-access.js';
import { stripe } from '@better-auth/stripe';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { EmailValidationService } from './common/services/email-validation.service.js';
import { escapeHtml } from './common/utils/escape-html.util.js';

const prisma = new PrismaClient();

const defaultPort = process.env.PORT ?? '3005';
const baseURL =
  process.env.BETTER_AUTH_URL ?? `http://localhost:${defaultPort}`;
const secret = process.env.BETTER_AUTH_SECRET;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const emailValidationService = new EmailValidationService();

// Configure Resend if API key is available
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : undefined;
const emailFrom =
  process.env.RESEND_FROM_EMAIL ?? 'StreetGadgets <onboarding@resend.dev>';

// Only initialise Stripe if keys are configured
const stripeClient = stripeSecretKey ? new Stripe(stripeSecretKey) : undefined;

const frontendURL = process.env.FRONTEND_URL ?? 'http://localhost:3000';

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
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'CUSTOMER',
        input: false,
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
        type: 'date',
        required: true,
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
        subject: 'Reset Your Password — StreetGadgets',
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
        subject: 'Verify Your Email — StreetGadgets',
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
            (await emailValidationService.hasValidMxRecords(user.email))
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
