import { z } from 'zod';

/**
 * Boot-time environment validation, wired via
 * `ConfigModule.forRoot({ validate: loadEnv })`. Fails fast (the app refuses to
 * boot) when a critical variable is missing or malformed. Non-critical
 * integrations are optional so local/dev setups boot without every key.
 */
const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3005),

    // Database (Prisma 7 driver adapter). DATABASE_URL is required at runtime;
    // DIRECT_URL is used for migrations / DDL (PRISMA_USE_DIRECT_URL=1).
    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1).optional(),
    PRISMA_USE_DIRECT_URL: z.string().optional(),

    // Redis (BullMQ). Optional — falls back to localhost in app.module.
    REDIS_URL: z.string().optional(),

    // Better Auth
    BETTER_AUTH_SECRET: z.string().min(1).optional(),
    BETTER_AUTH_URL: z.url().optional(),
    JWT_ISSUER: z.string().optional(),
    JWT_AUDIENCE: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    // HTTP / CORS
    CORS_ORIGINS: z.string().optional(),
    FRONTEND_URL: z.url().optional(),

    // Email (Resend)
    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM_EMAIL: z.string().optional(),

    // Stripe
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    // Secrets that are optional in dev/test but required in production.
    if (env.NODE_ENV === 'production') {
      if (!env.BETTER_AUTH_SECRET) {
        ctx.addIssue({
          code: 'custom',
          path: ['BETTER_AUTH_SECRET'],
          message: 'BETTER_AUTH_SECRET is required in production',
        });
      }
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(config: Record<string, unknown>): Env {
  const parsed = EnvSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
