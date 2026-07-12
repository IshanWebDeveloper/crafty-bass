/**
 * Seeds development users for manual testing of the login / register flows
 * and the marketplace surface.
 *
 * Why this script exists separately from seed.ts: taxonomy seeding is safe to
 * run in CI / against a fresh test DB, while user fixtures contain hashed
 * passwords and should only be applied to a local dev database.
 *
 * Run: `pnpm --filter @repo/db db:seed:users`
 *   (loads apps/backend/.env via dotenv)
 *
 * NODE_ENV must be set to 'test' BEFORE `@repo/auth` is evaluated so its
 * `databaseHooks.user.create.before` skips the MX-record sanity check for the
 * @example.com fixture addresses. ESM hoists all `import` declarations above
 * any side-effecting top-level statement, so we use `await import(...)` (top
 * level await) instead of static imports - the env mutation runs first, then
 * @repo/auth initialises, then better-auth's hook reads the patched value.
 *
 * Idempotent - re-running is a no-op for already-existing users (signup is
 * caught as a UNIQUE-email conflict; profiles/jobs upsert).
 *
 * Common password for every seeded account: `Password123!`
 */
process.env.NODE_ENV ??= 'test';

const { prisma } = await import('../src/index.js');
// Dev-only seed script: importing @repo/auth from @repo/db creates a build-time
// circular dependency at the Nx workspace level. The script is never part of
// the production graph (it's invoked through pnpm scripts, not built into
// dist), so we silence the boundary rule here rather than restructure.
// eslint-disable-next-line @nx/enforce-module-boundaries
const { auth } = await import('@repo/auth');

// Mark this file as a module so TypeScript allows the top-level `await`
// import calls above (TS1375). The script has no other exports.
export {};

const COMMON_PASSWORD = 'Password123!';

type SeedUser = {
  email: string;
  name: string;
  // E.164 phone for OTP login. Sign in by typing the local form (e.g. the
  // "077 100 0005" matching "+94771000005"); the dev OTP prints to the backend
  // console. Each must be unique (phoneNumber has a unique index).
  phone: string;
  role?: 'ADMIN' | 'SUPPORT';
  userType?: 'HOMEOWNER' | 'TRADESMAN';
  homeowner?: {
    locationText?: string;
    city?: string;
    district?: string;
    postalCode?: string;
  };
  tradesman?: {
    bio?: string;
    yearsExperience: number;
    hourlyRate?: number;
    city?: string;
    district?: string;
    serviceRadiusKm: number;
    skillSlugs: string[];
    // Verified tradesmen can quote; unverified ones are gated. Mix both so the
    // browse-jobs gating + profile verification card are testable.
    isVerified?: boolean;
    // Surfaced as a badge on the card/profile; seeds an (approved) verification
    // record so it's visible in dev.
    primaryTrade?: string;
  };
};

const users: SeedUser[] = [
  {
    email: 'admin@example.com',
    name: 'Admin User',
    phone: '+94771000001',
    role: 'ADMIN',
  },
  {
    email: 'support@example.com',
    name: 'Support User',
    phone: '+94771000002',
    role: 'SUPPORT',
  },
  {
    email: 'anna@example.com',
    name: 'Anna Perera',
    phone: '+94771000003',
    userType: 'HOMEOWNER',
    homeowner: {
      locationText: '14 Galle Road',
      city: 'Colombo',
      district: 'Colombo',
      postalCode: '00300',
    },
  },
  {
    email: 'ben@example.com',
    name: 'Ben Silva',
    phone: '+94771000004',
    userType: 'HOMEOWNER',
    homeowner: {
      locationText: '6 Lake Drive',
      city: 'Kandy',
      district: 'Kandy',
      postalCode: '20000',
    },
  },
  {
    email: 'priya@example.com',
    name: 'Priya Fernando',
    phone: '+94771000005',
    userType: 'TRADESMAN',
    tradesman: {
      bio: 'Licensed plumber, 12 years on residential repairs and boiler service.',
      yearsExperience: 12,
      hourlyRate: 3500,
      city: 'Colombo',
      district: 'Colombo',
      serviceRadiusKm: 25,
      skillSlugs: [
        'plumbing-leak-repair',
        'plumbing-boiler-service',
        'plumbing-fittings',
      ],
      primaryTrade: 'Plumbing',
      // Verified - can quote on browse-jobs and shows the green seal.
      isVerified: true,
    },
  },
  {
    email: 'kasun@example.com',
    name: 'Kasun Jayasinghe',
    phone: '+94771000006',
    userType: 'TRADESMAN',
    tradesman: {
      bio: 'Certified electrician focused on safe rewiring and lighting installs.',
      yearsExperience: 8,
      hourlyRate: 3000,
      city: 'Colombo',
      district: 'Colombo',
      serviceRadiusKm: 30,
      skillSlugs: [
        'electrical-wiring',
        'electrical-sockets',
        'electrical-lighting',
        'electrical-safety',
      ],
      primaryTrade: 'Electrical',
      // Unverified - quoting is gated; profile shows "Verification required".
      isVerified: false,
    },
  },
  {
    email: 'ravi@example.com',
    name: 'Ravi Kumar',
    phone: '+94771000007',
    userType: 'TRADESMAN',
    tradesman: {
      bio: 'Painter and finishing carpenter. Interior + exterior work.',
      yearsExperience: 6,
      hourlyRate: 2500,
      city: 'Kandy',
      district: 'Kandy',
      serviceRadiusKm: 40,
      skillSlugs: [
        'painting-interior',
        'painting-exterior',
        'painting-wall-prep',
        'carpentry-doors-windows',
      ],
      primaryTrade: 'Painting',
      isVerified: false,
    },
  },
];

async function ensureUser(seed: SeedUser): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email: seed.email },
    select: { id: true },
  });
  if (existing) return existing.id;

  try {
    await auth.api.signUpEmail({
      body: {
        email: seed.email,
        name: seed.name,
        password: COMMON_PASSWORD,
        privacyPolicyAcceptedAt: new Date(),
      },
    });
  } catch (err) {
    // Email may already exist if a partial run left state behind; recover.
    const message = err instanceof Error ? err.message : String(err);
    if (!message.toLowerCase().includes('already')) {
      throw err;
    }
  }

  const created = await prisma.user.findUnique({
    where: { email: seed.email },
    select: { id: true },
  });
  if (!created) {
    throw new Error(`Failed to create user ${seed.email}`);
  }
  return created.id;
}

async function applyRoleAndType(userId: string, seed: SeedUser) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(seed.role ? { role: seed.role } : {}),
      ...(seed.userType ? { userType: seed.userType } : {}),
      // Set the OTP-login phone (already "verified" for these fixtures).
      phone: seed.phone,
      phoneNumber: seed.phone,
      phoneNumberVerified: true,
    },
  });
}

async function applyHomeownerProfile(userId: string, seed: SeedUser) {
  if (!seed.homeowner) return;
  await prisma.homeownerProfile.upsert({
    where: { userId },
    create: {
      userId,
      locationText: seed.homeowner.locationText ?? null,
      city: seed.homeowner.city ?? null,
      district: seed.homeowner.district ?? null,
      postalCode: seed.homeowner.postalCode ?? null,
      preferredLanguage: 'EN',
    },
    update: {
      locationText: seed.homeowner.locationText ?? null,
      city: seed.homeowner.city ?? null,
      district: seed.homeowner.district ?? null,
      postalCode: seed.homeowner.postalCode ?? null,
    },
  });
}

async function applyTradesmanProfile(userId: string, seed: SeedUser) {
  if (!seed.tradesman) return;

  const skills = await prisma.skill.findMany({
    where: { slug: { in: seed.tradesman.skillSlugs } },
    select: { id: true },
  });

  const profile = await prisma.tradesmanProfile.upsert({
    where: { userId },
    create: {
      userId,
      bio: seed.tradesman.bio ?? null,
      yearsExperience: seed.tradesman.yearsExperience,
      hourlyRate: seed.tradesman.hourlyRate ?? null,
      city: seed.tradesman.city ?? null,
      district: seed.tradesman.district ?? null,
      serviceRadiusKm: seed.tradesman.serviceRadiusKm,
      isVerified: seed.tradesman.isVerified ?? false,
      preferredLanguage: 'EN',
    },
    update: {
      bio: seed.tradesman.bio ?? null,
      yearsExperience: seed.tradesman.yearsExperience,
      hourlyRate: seed.tradesman.hourlyRate ?? null,
      city: seed.tradesman.city ?? null,
      district: seed.tradesman.district ?? null,
      serviceRadiusKm: seed.tradesman.serviceRadiusKm,
      isVerified: seed.tradesman.isVerified ?? false,
    },
    select: { id: true },
  });

  // Reset skill links to match the seed list.
  await prisma.tradesmanSkill.deleteMany({
    where: { tradesmanProfileId: profile.id },
  });
  if (skills.length > 0) {
    await prisma.tradesmanSkill.createMany({
      data: skills.map((s) => ({
        tradesmanProfileId: profile.id,
        skillId: s.id,
      })),
      skipDuplicates: true,
    });
  }

  // Seed a verification record carrying the primary trade so the badge is
  // visible in dev (seeded tradesmen otherwise have no verification record).
  if (seed.tradesman.primaryTrade) {
    const verificationData = {
      fullName: seed.name,
      nicNumber: `${(seed.phone ?? '').replace(/\D/g, '').slice(-9) || '000000000'}V`,
      primaryTrade: seed.tradesman.primaryTrade,
      city: seed.tradesman.city ?? null,
      district: seed.tradesman.district ?? null,
      yearsExperience: seed.tradesman.yearsExperience,
      status: (seed.tradesman.isVerified ? 'APPROVED' : 'PENDING') as
        | 'APPROVED'
        | 'PENDING',
    };
    await prisma.tradesmanVerification.upsert({
      where: { userId },
      create: { userId, ...verificationData },
      update: verificationData,
    });
  }
}

async function seedSampleJobs(homeownerEmails: Record<string, string>) {
  const annaId = homeownerEmails['anna@example.com'];
  const benId = homeownerEmails['ben@example.com'];
  if (!annaId || !benId) return;

  const plumbing = await prisma.serviceCategory.findUnique({
    where: { slug: 'plumbing' },
    select: { id: true },
  });
  const electrical = await prisma.serviceCategory.findUnique({
    where: { slug: 'electrical' },
    select: { id: true },
  });

  await prisma.job.upsert({
    where: { id: 'seed-job-anna-tap' },
    update: {},
    create: {
      id: 'seed-job-anna-tap',
      homeownerId: annaId,
      title: 'Kitchen tap leak under the sink',
      description:
        'Cold water tap drips constantly and the cupboard underneath is damp. Looking for someone to diagnose and replace if needed. Access is fine.',
      descriptionLanguage: 'EN',
      categoryId: plumbing?.id ?? null,
      urgency: 'HIGH',
      city: 'Colombo',
      district: 'Colombo',
      budgetMin: 5000,
      budgetMax: 12000,
      status: 'OPEN',
    },
  });

  await prisma.job.upsert({
    where: { id: 'seed-job-ben-rewire' },
    update: {},
    create: {
      id: 'seed-job-ben-rewire',
      homeownerId: benId,
      title: 'Bedroom rewiring + new ceiling lights',
      description:
        'Two bedrooms need to be rewired and four new pendant lights installed. Old wiring is in poor condition. Quotes welcome with itemised cost.',
      descriptionLanguage: 'EN',
      categoryId: electrical?.id ?? null,
      urgency: 'MEDIUM',
      city: 'Kandy',
      district: 'Kandy',
      budgetMin: 40000,
      budgetMax: 80000,
      status: 'OPEN',
    },
  });
}

async function main() {
  const emailToId: Record<string, string> = {};

  for (const seed of users) {
    const id = await ensureUser(seed);
    emailToId[seed.email] = id;
    await applyRoleAndType(id, seed);
    await applyHomeownerProfile(id, seed);
    await applyTradesmanProfile(id, seed);
  }

  await seedSampleJobs(emailToId);

  console.log(
    `Seeded ${users.length} users - sign in by phone (OTP prints to this ` +
      `console in dev) or email + password ${COMMON_PASSWORD}.`,
  );
  for (const u of users) {
    const tag = u.role ?? u.userType ?? 'USER';
    const verified =
      u.tradesman?.isVerified === true
        ? ' [verified]'
        : u.userType === 'TRADESMAN'
          ? ' [unverified]'
          : '';
    console.log(`  - ${u.phone}  ${u.email}  (${tag})${verified}`);
  }
  console.log(
    'Sample OPEN jobs: kitchen tap leak (Anna), bedroom rewire (Ben).',
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
