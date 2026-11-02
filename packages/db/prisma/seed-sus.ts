/**
 * Seeds (and resets) the accounts and data for the SUS usability study.
 *
 * Participants P01-P10 mirror the "Crafty Bass - SUS Participants" sheet and
 * the SUS Study Pack (CI6600). Odd codes are homeowners (tasks H1-H5), even
 * codes are tradesmen (tasks T1-T4).
 *
 *   Homeowner (H4/H5): owns an OPEN job "Re-tile the bathroom wall" with two
 *     PENDING quotes from verified tilers, each requesting a materials deposit,
 *     so accepting one creates a REQUESTED escrow to fund with the Stripe test
 *     card.
 *   Homeowner (H3): two verified plumbers near Colombo, so the kitchen-tap job
 *     the participant posts in H2 has someone to recommend.
 *   Tradesman (T1): verified, with exactly one skill, so there is one to add.
 *   Tradesman (T2/T3): shared OPEN welding jobs in Colombo to find and quote on.
 *   Tradesman (T4): an ASSIGNED job "Replace gate hinges" whose deposit escrow
 *     is already FUNDED, so "Start work" (releaseMaterials) is available.
 *
 * Re-running is a reset: each participant's jobs, quotes on the shared jobs,
 * notifications and skills go back to the starting state. Run it before every
 * session, or reset one participant:
 *
 *   pnpm --filter @repo/db db:seed:sus            # everyone
 *   pnpm --filter @repo/db db:seed:sus -- P03     # just P03
 *
 * Needs `pnpm --filter @repo/db db:seed` (taxonomy) to have run first.
 * Sign in by phone with the local form (P01 = "077 000 0001"); the dev OTP
 * prints to the backend console. Password login: Password123!
 */
process.env.NODE_ENV ??= 'test';

const { prisma } = await import('../src/index.js');
// Dev-only seed script, same boundary exception as seed-users.ts.
// eslint-disable-next-line @nx/enforce-module-boundaries
const { auth } = await import('@repo/auth');

export {};

const COMMON_PASSWORD = 'Password123!';

type Lang = 'EN' | 'SI' | 'TA';
type Line = {
  category: 'LABOUR' | 'MATERIAL';
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

// Colombo 03 area; small offsets so distances are non-zero but short.
const COLOMBO = { lat: 6.9022, lng: 79.8607 };
const near = (dLat: number, dLng: number) => ({
  latitude: Number((COLOMBO.lat + dLat).toFixed(6)),
  longitude: Number((COLOMBO.lng + dLng).toFixed(6)),
});

// ---------------------------------------------------------------------------
// Participants (keep in sync with the participants sheet)
// ---------------------------------------------------------------------------

type Participant = {
  code: string;
  role: 'HOMEOWNER' | 'TRADESMAN';
  lang: Lang;
};

const PARTICIPANTS: Participant[] = [
  { code: 'P01', role: 'HOMEOWNER', lang: 'EN' },
  { code: 'P02', role: 'TRADESMAN', lang: 'SI' },
  { code: 'P03', role: 'HOMEOWNER', lang: 'TA' },
  { code: 'P04', role: 'TRADESMAN', lang: 'EN' },
  { code: 'P05', role: 'HOMEOWNER', lang: 'EN' },
  { code: 'P06', role: 'TRADESMAN', lang: 'SI' },
  { code: 'P07', role: 'HOMEOWNER', lang: 'TA' },
  { code: 'P08', role: 'TRADESMAN', lang: 'EN' },
  { code: 'P09', role: 'HOMEOWNER', lang: 'SI' },
  { code: 'P10', role: 'TRADESMAN', lang: 'EN' },
];

const num = (code: string) => Number(code.slice(1));
const participantPhone = (code: string) =>
  `+9477000000${String(num(code)).padStart(2, '0')}`.replace(
    /^\+9477000000(\d{2})$/,
    '+947700000$1',
  );
const participantEmail = (code: string) =>
  `sus-${code.toLowerCase()}@example.com`;
const roleLabel = (r: Participant['role']) =>
  r === 'HOMEOWNER' ? 'Homeowner' : 'Tradesman';

// ---------------------------------------------------------------------------
// Supporting accounts (never handed to a participant)
// ---------------------------------------------------------------------------

type SupportTradesman = {
  key: string;
  email: string;
  name: string;
  phone: string;
  bio: string;
  trade: string;
  skillSlugs: string[];
  yearsExperience: number;
  hourlyRate: number;
  avgRating: number;
  ratingCount: number;
  jobsCompleted: number;
  responseTimeMinutes: number;
  backgroundChecked: boolean;
  offset: [number, number];
};

const SUPPORT_TRADESMEN: SupportTradesman[] = [
  {
    key: 'tilerA',
    email: 'sus-tiler-a@example.com',
    name: 'Nimal Wickramasinghe',
    phone: '+94770000101',
    bio: 'Wall and floor tiling, bathrooms and kitchens. 15 years in Colombo.',
    trade: 'Masonry',
    skillSlugs: ['masonry-tiling', 'masonry-plastering'],
    yearsExperience: 15,
    hourlyRate: 3200,
    avgRating: 4.8,
    ratingCount: 42,
    jobsCompleted: 57,
    responseTimeMinutes: 35,
    backgroundChecked: true,
    offset: [0.012, 0.006],
  },
  {
    key: 'tilerB',
    email: 'sus-tiler-b@example.com',
    name: 'Tharindu Bandara',
    phone: '+94770000102',
    bio: 'Tiler and plasterer. Quick turnaround on small bathroom jobs.',
    trade: 'Masonry',
    skillSlugs: ['masonry-tiling', 'masonry-bricklaying'],
    yearsExperience: 5,
    hourlyRate: 2600,
    avgRating: 4.3,
    ratingCount: 9,
    jobsCompleted: 11,
    responseTimeMinutes: 12,
    backgroundChecked: false,
    offset: [-0.02, 0.015],
  },
  {
    key: 'plumberA',
    email: 'sus-plumber-a@example.com',
    name: 'Suresh Rajapaksha',
    phone: '+94770000103',
    bio: 'Plumber for leaks, taps and fittings. Same-day call-outs in Colombo.',
    trade: 'Plumbing',
    skillSlugs: ['plumbing-leak-repair', 'plumbing-fittings'],
    yearsExperience: 10,
    hourlyRate: 3000,
    avgRating: 4.6,
    ratingCount: 31,
    jobsCompleted: 40,
    responseTimeMinutes: 20,
    backgroundChecked: true,
    offset: [0.008, -0.004],
  },
  {
    key: 'plumberB',
    email: 'sus-plumber-b@example.com',
    name: 'Mohamed Rizwan',
    phone: '+94770000104',
    bio: 'Plumbing repairs and drain unblocking. New to Crafty Bass.',
    trade: 'Plumbing',
    skillSlugs: ['plumbing-leak-repair', 'plumbing-drain-unblocking'],
    yearsExperience: 7,
    hourlyRate: 2500,
    avgRating: 0,
    ratingCount: 0,
    jobsCompleted: 1,
    responseTimeMinutes: 0,
    backgroundChecked: false,
    offset: [-0.01, 0.01],
  },
];

const CLIENT = {
  email: 'sus-client@example.com',
  name: 'Dilani Gunawardena',
  phone: '+94770000201',
};

// Shared OPEN jobs for T2/T3, owned by the client.
const OPEN_JOBS = [
  {
    id: 'sus-open-gate-latch',
    title: 'Repair rusted gate latch and bolt',
    description:
      'The latch on our front steel gate has rusted and no longer holds. Needs the latch and drop bolt cut out and new ones welded on, then a coat of anti-rust paint.',
    skillSlug: 'welding-gates-grills',
    urgency: 'MEDIUM' as const,
    budgetMin: 6000,
    budgetMax: 12000,
    offset: [0.005, 0.009] as [number, number],
  },
  {
    id: 'sus-open-window-grill',
    title: 'Weld broken window grill bars',
    description:
      'Two bars on a ground-floor window grill have come loose at the weld. Looking for someone to re-weld them on site and touch up the paint.',
    skillSlug: 'welding-repairs',
    urgency: 'LOW' as const,
    budgetMin: 4000,
    budgetMax: 8000,
    offset: [-0.007, 0.004] as [number, number],
  },
  {
    // Different trade, so the job board isn't trivially filtered for them.
    id: 'sus-open-ceiling-fan',
    title: 'Install a ceiling fan in the living room',
    description:
      'Need a ceiling fan installed where a light fitting is now. Fan already bought; wiring point exists.',
    skillSlug: 'electrical-lighting',
    urgency: 'LOW' as const,
    budgetMin: 3000,
    budgetMax: 6000,
    offset: [0.003, -0.006] as [number, number],
  },
];

const BATHROOM_QUOTES: Record<
  'tilerA' | 'tilerB',
  {
    message: string;
    calloutFee: number;
    lines: Line[];
    startInDays: number;
    days: number;
  }
> = {
  tilerA: {
    message:
      'I can strip the old tiles, level the wall and fix new 30x60 ceramic tiles with waterproof grout. Price includes adhesive and trims.',
    calloutFee: 1500,
    lines: [
      {
        category: 'LABOUR',
        name: 'Remove old tiles and level wall',
        quantity: 1,
        unit: 'job',
        unitPrice: 8000,
      },
      {
        category: 'LABOUR',
        name: 'Fix new wall tiles and grout',
        quantity: 12,
        unit: 'm²',
        unitPrice: 1200,
      },
      {
        category: 'MATERIAL',
        name: 'Ceramic wall tiles 30x60',
        quantity: 12,
        unit: 'm²',
        unitPrice: 1650,
      },
      {
        category: 'MATERIAL',
        name: 'Tile adhesive',
        quantity: 4,
        unit: 'bag',
        unitPrice: 1300,
      },
      {
        category: 'MATERIAL',
        name: 'Waterproof grout and trims',
        quantity: 1,
        unit: 'set',
        unitPrice: 2400,
      },
    ],
    startInDays: 5,
    days: 3,
  },
  tilerB: {
    message:
      'Can start this week. Tiling over the existing surface after a skim coat keeps the cost down.',
    calloutFee: 0,
    lines: [
      {
        category: 'LABOUR',
        name: 'Skim coat and tile wall',
        quantity: 12,
        unit: 'm²',
        unitPrice: 1400,
      },
      {
        category: 'MATERIAL',
        name: 'Ceramic wall tiles 30x60',
        quantity: 12,
        unit: 'm²',
        unitPrice: 1350,
      },
      {
        category: 'MATERIAL',
        name: 'Adhesive and grout',
        quantity: 1,
        unit: 'set',
        unitPrice: 4200,
      },
    ],
    startInDays: 2,
    days: 2,
  },
};

const GATE_QUOTE = {
  message:
    'Replace both hinges on the main gate with heavy-duty weld-on hinges and realign the gate.',
  calloutFee: 0,
  lines: [
    {
      category: 'LABOUR',
      name: 'Cut out old hinges, weld new ones, realign gate',
      quantity: 1,
      unit: 'job',
      unitPrice: 4500,
    },
    {
      category: 'MATERIAL',
      name: 'Heavy-duty weld-on gate hinge',
      quantity: 2,
      unit: 'pcs',
      unitPrice: 1800,
    },
    {
      category: 'MATERIAL',
      name: 'Welding rods and anti-rust primer',
      quantity: 1,
      unit: 'set',
      unitPrice: 1100,
    },
  ] as Line[],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;

function totals(lines: Line[], calloutFee: number) {
  const materials = lines
    .filter((l) => l.category === 'MATERIAL')
    .reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const labour = lines
    .filter((l) => l.category === 'LABOUR')
    .reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  return { materials, total: labour + materials + calloutFee };
}

async function ensureUser(email: string, name: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) return existing.id;
  try {
    await auth.api.signUpEmail({
      body: {
        email,
        name,
        password: COMMON_PASSWORD,
        privacyPolicyAcceptedAt: new Date(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.toLowerCase().includes('already')) throw err;
  }
  const created = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!created) throw new Error(`Failed to create user ${email}`);
  return created.id;
}

async function setIdentity(
  userId: string,
  data: { name: string; phone: string; userType: 'HOMEOWNER' | 'TRADESMAN' },
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      userType: data.userType,
      phone: data.phone,
      phoneNumber: data.phone,
      phoneNumberVerified: true,
    },
  });
}

async function skillIds(slugs: string[]) {
  const skills = await prisma.skill.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const missing = slugs.filter((s) => !skills.some((k) => k.slug === s));
  if (missing.length) {
    throw new Error(
      `Missing skills ${missing.join(', ')}. Run "pnpm --filter @repo/db db:seed" first.`,
    );
  }
  return skills;
}

async function categoryIdForSkill(slug: string) {
  const skill = await prisma.skill.findUnique({
    where: { slug },
    select: { categoryId: true },
  });
  if (!skill) throw new Error(`Missing skill ${slug}`);
  return skill.categoryId;
}

async function upsertVerifiedTradesman(
  userId: string,
  t: {
    name: string;
    phone: string;
    bio: string;
    trade: string;
    skillSlugs: string[];
    yearsExperience: number;
    hourlyRate: number;
    lang: Lang;
    offset: [number, number];
    avgRating?: number;
    ratingCount?: number;
    jobsCompleted?: number;
    responseTimeMinutes?: number;
    backgroundChecked?: boolean;
  },
) {
  const profileData = {
    bio: t.bio,
    yearsExperience: t.yearsExperience,
    hourlyRate: t.hourlyRate,
    locationText: 'Colombo',
    city: 'Colombo',
    district: 'Colombo',
    ...near(t.offset[0], t.offset[1]),
    serviceRadiusKm: 25,
    isVerified: true,
    isAvailable: true,
    backgroundChecked: t.backgroundChecked ?? false,
    avgRating: t.avgRating ?? 0,
    ratingCount: t.ratingCount ?? 0,
    jobsCompleted: t.jobsCompleted ?? 0,
    jobsCancelled: 0,
    responseTimeMinutes: t.responseTimeMinutes ?? 0,
    preferredLanguage: t.lang,
  };
  const profile = await prisma.tradesmanProfile.upsert({
    where: { userId },
    create: { userId, ...profileData },
    update: profileData,
    select: { id: true },
  });

  const skills = await skillIds(t.skillSlugs);
  await prisma.tradesmanSkill.deleteMany({
    where: { tradesmanProfileId: profile.id },
  });
  await prisma.tradesmanSkill.createMany({
    data: skills.map((s) => ({
      tradesmanProfileId: profile.id,
      skillId: s.id,
    })),
    skipDuplicates: true,
  });

  const verification = {
    fullName: t.name,
    nicNumber: `${t.phone.replace(/\D/g, '').slice(-9)}V`,
    primaryTrade: t.trade,
    city: 'Colombo',
    district: 'Colombo',
    yearsExperience: t.yearsExperience,
    serviceRadiusKm: 25,
    status: 'APPROVED' as const,
    reviewedAt: new Date(),
    rejectionReason: null,
  };
  await prisma.tradesmanVerification.upsert({
    where: { userId },
    create: { userId, ...verification },
    update: verification,
  });
}

async function createQuote(args: {
  id: string;
  jobId: string;
  tradesmanId: string;
  message: string;
  calloutFee: number;
  lines: Line[];
  status: 'PENDING' | 'ACCEPTED';
  startInDays: number;
  days: number;
}) {
  const { materials, total } = totals(args.lines, args.calloutFee);
  const start = new Date(Date.now() + args.startInDays * DAY);
  await prisma.quote.create({
    data: {
      id: args.id,
      jobId: args.jobId,
      tradesmanId: args.tradesmanId,
      amount: total,
      materialsAmount: materials,
      calloutFee: args.calloutFee || null,
      depositRequested: materials,
      currency: 'LKR',
      message: args.message,
      estimatedStart: start,
      estimatedCompletion: new Date(start.getTime() + args.days * DAY),
      validUntil: new Date(Date.now() + 30 * DAY),
      status: args.status,
      respondedAt: args.status === 'ACCEPTED' ? new Date() : null,
      materials: {
        create: args.lines.map((l) => ({
          category: l.category,
          name: l.name,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unitPrice,
        })),
      },
    },
  });
  return { materials, total };
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

async function seedSupport() {
  const ids: Record<string, string> = {};
  for (const t of SUPPORT_TRADESMEN) {
    const id = await ensureUser(t.email, t.name);
    await setIdentity(id, {
      name: t.name,
      phone: t.phone,
      userType: 'TRADESMAN',
    });
    await upsertVerifiedTradesman(id, { ...t, lang: 'EN' });
    ids[t.key] = id;
  }

  const clientId = await ensureUser(CLIENT.email, CLIENT.name);
  await setIdentity(clientId, {
    name: CLIENT.name,
    phone: CLIENT.phone,
    userType: 'HOMEOWNER',
  });
  const homeowner = {
    locationText: '22 Bagatalle Road',
    city: 'Colombo',
    district: 'Colombo',
    postalCode: '00300',
    preferredLanguage: 'EN' as const,
  };
  await prisma.homeownerProfile.upsert({
    where: { userId: clientId },
    create: { userId: clientId, ...homeowner },
    update: homeowner,
  });

  for (const j of OPEN_JOBS) {
    const categoryId = await categoryIdForSkill(j.skillSlug);
    const [skill] = await skillIds([j.skillSlug]);
    const data = {
      homeownerId: clientId,
      title: j.title,
      description: j.description,
      descriptionLanguage: 'EN' as const,
      categoryId,
      urgency: j.urgency,
      locationText: 'Colombo 03',
      city: 'Colombo',
      district: 'Colombo',
      ...near(j.offset[0], j.offset[1]),
      budgetMin: j.budgetMin,
      budgetMax: j.budgetMax,
      status: 'OPEN' as const,
      // No expiry, so the job stays on the board for the whole study.
      expiresAt: null,
    };
    await prisma.job.upsert({
      where: { id: j.id },
      create: { id: j.id, ...data },
      update: data,
    });
    await prisma.jobSkill.upsert({
      where: { jobId_skillId: { jobId: j.id, skillId: skill.id } },
      create: { jobId: j.id, skillId: skill.id, source: 'manual' },
      update: {},
    });
  }

  return { tradesmen: ids, clientId };
}

async function resetParticipant(userId: string) {
  // Their own jobs (H2's posted job, the bathroom job; cascades quotes,
  // escrow, recommendations and notifications on those jobs).
  await prisma.job.deleteMany({ where: { homeownerId: userId } });
  // Jobs assigned to them (the gate job) and anything they quoted on.
  await prisma.job.deleteMany({
    where: { assignedTradesmanId: userId, id: { startsWith: 'sus-' } },
  });
  await prisma.quote.deleteMany({ where: { tradesmanId: userId } });
  await prisma.notification.deleteMany({ where: { userId } });
  // Log out any session left over from a previous participant.
  await prisma.session.deleteMany({ where: { userId } });
}

async function seedHomeowner(
  p: Participant,
  userId: string,
  support: { tradesmen: Record<string, string> },
) {
  const profile = {
    locationText: `${10 + num(p.code)} Galle Road`,
    city: 'Colombo',
    district: 'Colombo',
    postalCode: '00300',
    preferredLanguage: p.lang,
  };
  await prisma.homeownerProfile.upsert({
    where: { userId },
    create: { userId, ...profile },
    update: profile,
  });

  const jobId = `sus-${p.code.toLowerCase()}-bathroom`;
  const [tiling] = await skillIds(['masonry-tiling']);
  await prisma.job.create({
    data: {
      id: jobId,
      homeownerId: userId,
      title: 'Re-tile the bathroom wall',
      description:
        'The tiles on one bathroom wall (about 12 square metres) are cracked and some have come loose. Looking for someone to remove them and re-tile the wall.',
      descriptionLanguage: 'EN',
      categoryId: tiling ? await categoryIdForSkill('masonry-tiling') : null,
      urgency: 'MEDIUM',
      locationText: profile.locationText,
      city: 'Colombo',
      district: 'Colombo',
      ...near(0, 0),
      budgetMin: 40000,
      budgetMax: 70000,
      status: 'OPEN',
      expiresAt: null,
      skills: { create: [{ skillId: tiling.id, source: 'manual' }] },
    },
  });

  for (const key of ['tilerA', 'tilerB'] as const) {
    const q = BATHROOM_QUOTES[key];
    await createQuote({
      id: `${jobId}-${key}`,
      jobId,
      tradesmanId: support.tradesmen[key],
      message: q.message,
      calloutFee: q.calloutFee,
      lines: q.lines,
      status: 'PENDING',
      startInDays: q.startInDays,
      days: q.days,
    });
  }
}

async function seedTradesman(
  p: Participant,
  userId: string,
  clientId: string,
  name: string,
  phone: string,
) {
  // One skill only, so T1 ("add one more skill") has something to add.
  await upsertVerifiedTradesman(userId, {
    name,
    phone,
    bio: 'Welder for gates, grills and small steel repairs around Colombo.',
    trade: 'Welding',
    skillSlugs: ['welding-gates-grills'],
    yearsExperience: 6,
    hourlyRate: 2800,
    lang: p.lang,
    offset: [0.004 * (num(p.code) % 3), -0.003],
    avgRating: 4.5,
    ratingCount: 8,
    jobsCompleted: 10,
    responseTimeMinutes: 25,
  });

  const jobId = `sus-${p.code.toLowerCase()}-gate`;
  const quoteId = `${jobId}-quote`;
  const categoryId = await categoryIdForSkill('welding-gates-grills');
  const [skill] = await skillIds(['welding-gates-grills']);

  await prisma.job.create({
    data: {
      id: jobId,
      homeownerId: clientId,
      title: 'Replace gate hinges',
      description:
        'Both hinges on the main driveway gate are worn and the gate drags on the ground. Please replace them and realign the gate.',
      descriptionLanguage: 'EN',
      categoryId,
      urgency: 'MEDIUM',
      locationText: '22 Bagatalle Road',
      city: 'Colombo',
      district: 'Colombo',
      ...near(0.002, 0.002),
      budgetMin: 6000,
      budgetMax: 10000,
      status: 'OPEN',
      expiresAt: null,
      skills: { create: [{ skillId: skill.id, source: 'manual' }] },
    },
  });

  const { materials, total } = await createQuote({
    id: quoteId,
    jobId,
    tradesmanId: userId,
    message: GATE_QUOTE.message,
    calloutFee: GATE_QUOTE.calloutFee,
    lines: GATE_QUOTE.lines,
    status: 'ACCEPTED',
    startInDays: 1,
    days: 1,
  });

  // Same end state as QuotesService.accept followed by a completed Stripe
  // checkout (EscrowService.finalizeFunded): job ASSIGNED, escrow FUNDED.
  const fundedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'ASSIGNED',
      assignedTradesmanId: userId,
      acceptedQuoteId: quoteId,
    },
  });
  await prisma.jobEscrow.create({
    data: {
      jobId,
      quoteId,
      homeownerId: clientId,
      tradesmanId: userId,
      currency: 'LKR',
      quoteTotal: total,
      materialsAmount: materials,
      depositAmount: materials,
      balanceAmount: total - materials,
      status: 'FUNDED',
      paymentMethod: 'card',
      paymentRef: `seed-sus-${p.code.toLowerCase()}`,
      fundedAt,
      transactions: {
        create: {
          type: 'FUND',
          amount: materials,
          note: 'Materials deposit funded (SUS seed)',
        },
      },
    },
  });
}

async function main() {
  const only = process.argv
    .slice(2)
    .map((a) => a.toUpperCase())
    .filter((a) => /^P\d{2}$/.test(a));
  const unknown = only.filter((c) => !PARTICIPANTS.some((p) => p.code === c));
  if (unknown.length)
    throw new Error(`Unknown participant code(s): ${unknown.join(', ')}`);
  const targets = only.length
    ? PARTICIPANTS.filter((p) => only.includes(p.code))
    : PARTICIPANTS;

  const support = await seedSupport();

  for (const p of targets) {
    const name = `SUS ${p.code} ${roleLabel(p.role)}`;
    const phone = participantPhone(p.code);
    const userId = await ensureUser(participantEmail(p.code), name);
    await setIdentity(userId, { name, phone, userType: p.role });
    await resetParticipant(userId);
    if (p.role === 'HOMEOWNER') {
      await seedHomeowner(p, userId, support);
    } else {
      await seedTradesman(p, userId, support.clientId, name, phone);
    }
  }

  console.log(
    `SUS study: reset ${targets.length} participant(s). Password for all: ${COMMON_PASSWORD}`,
  );
  for (const p of targets) {
    const local = participantPhone(p.code)
      .replace('+94', '0')
      .replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3');
    const state =
      p.role === 'HOMEOWNER'
        ? 'bathroom job + 2 pending quotes'
        : 'verified, 1 skill, funded gate job';
    console.log(
      `  ${p.code}  ${local}  ${roleLabel(p.role).padEnd(9)}  ${p.lang}  ${state}`,
    );
  }
  console.log(
    `Open jobs for T2/T3: ${OPEN_JOBS.map((j) => j.title).join('; ')}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
