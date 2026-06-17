/**
 * Seeds development users for manual testing of the login / register flows
 * and the marketplace surface.
 *
 * Why this script exists separately from seed.ts: taxonomy seeding is safe to
 * run in CI / against a fresh test DB, while user fixtures contain hashed
 * passwords and should only be applied to a local dev database.
 *
 * Run: `pnpm --filter @repo/db db:seed:users`
 *   (loads apps/backend/.env via dotenv; NODE_ENV is forced to 'test' so
 *    better-auth's MX-record sanity check is skipped for the @example.com
 *    fixture addresses)
 *
 * Idempotent — re-running is a no-op for already-existing users (signup is
 * caught as a UNIQUE-email conflict; profiles/jobs upsert).
 *
 * Common password for every seeded account: `Password123!`
 */
process.env.NODE_ENV ??= 'test';

import { prisma } from '../src/index.js';
import { auth } from '@repo/auth';

const COMMON_PASSWORD = 'Password123!';

type SeedUser = {
  email: string;
  name: string;
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
  };
};

const users: SeedUser[] = [
  {
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'ADMIN',
  },
  {
    email: 'support@example.com',
    name: 'Support User',
    role: 'SUPPORT',
  },
  {
    email: 'anna@example.com',
    name: 'Anna Perera',
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
    },
  },
  {
    email: 'kasun@example.com',
    name: 'Kasun Jayasinghe',
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
    },
  },
  {
    email: 'ravi@example.com',
    name: 'Ravi Kumar',
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
      preferredLanguage: 'EN',
    },
    update: {
      bio: seed.tradesman.bio ?? null,
      yearsExperience: seed.tradesman.yearsExperience,
      hourlyRate: seed.tradesman.hourlyRate ?? null,
      city: seed.tradesman.city ?? null,
      district: seed.tradesman.district ?? null,
      serviceRadiusKm: seed.tradesman.serviceRadiusKm,
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

  console.log(`Seeded ${users.length} users (password: ${COMMON_PASSWORD}).`);
  for (const u of users) {
    const tag = u.role ?? u.userType ?? 'USER';
    console.log(`  - ${u.email}  (${tag})`);
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
