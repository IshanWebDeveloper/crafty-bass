import { z } from 'zod';

// Shared enums (mirror packages/db/prisma/schema.prisma)
export const LanguageCodeSchema = z.enum(['EN', 'SI', 'TA']);
export const JobUrgencySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY']);
export const TaskSizeSchema = z.enum(['SMALL', 'MEDIUM', 'LARGE']);
export const VehicleRequirementSchema = z.enum(['NONE', 'CAR', 'TRUCK']);
export const JobStatusSchema = z.enum([
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
]);
export const QuoteStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'EXPIRED',
]);
export const ConversationTypeSchema = z.enum([
  'JOB_DIRECT',
  'DIRECT',
  'SUPPORT',
]);
export const MessageTypeSchema = z.enum(['TEXT', 'IMAGE', 'FILE', 'SYSTEM']);
export const ReportStatusSchema = z.enum([
  'OPEN',
  'UNDER_REVIEW',
  'RESOLVED',
  'DISMISSED',
]);
export const ReportTargetTypeSchema = z.enum([
  'USER',
  'JOB',
  'QUOTE',
  'REVIEW',
  'MESSAGE',
]);

const id = z.string().trim().min(1);
const optionalText = (max: number) => z.string().trim().max(max).optional();

// --- Profiles ---
export const HomeownerProfileSchema = z.object({
  locationText: optionalText(200),
  city: optionalText(80),
  district: optionalText(80),
  postalCode: optionalText(20),
  preferredLanguage: LanguageCodeSchema.default('EN'),
});

export const TradesmanProfileSchema = z.object({
  bio: optionalText(2000),
  yearsExperience: z.coerce.number().int().min(0).max(80).default(0),
  hourlyRate: z.coerce.number().positive().max(1_000_000).optional(),
  locationText: optionalText(200),
  city: optionalText(80),
  district: optionalText(80),
  serviceRadiusKm: z.coerce.number().int().min(0).max(500).default(15),
  preferredLanguage: LanguageCodeSchema.default('EN'),
  skillIds: z.array(id).max(50).optional(),
  certifications: z.array(z.string().trim().min(1).max(160)).max(30).optional(),
  vehicles: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
});

// --- Jobs ---
export const CreateJobSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(10).max(5000),
    descriptionLanguage: LanguageCodeSchema.default('EN'),
    categoryId: id.optional(),
    skillIds: z.array(id).max(20).optional(),
    locationText: optionalText(200),
    city: optionalText(80),
    district: optionalText(80),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    budgetMin: z.coerce.number().nonnegative().max(100_000_000).optional(),
    budgetMax: z.coerce.number().nonnegative().max(100_000_000).optional(),
    scheduledFor: z.coerce.date().optional(),
    urgency: JobUrgencySchema.default('MEDIUM'),
    taskSize: TaskSizeSchema.optional(),
    vehicleRequirement: VehicleRequirementSchema.optional(),
  })
  .refine(
    (v) =>
      v.budgetMin === undefined ||
      v.budgetMax === undefined ||
      v.budgetMax >= v.budgetMin,
    {
      message: 'budgetMax must be greater than or equal to budgetMin',
      path: ['budgetMax'],
    },
  );

export const UpdateJobSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(10).max(5000),
    categoryId: id.nullable(),
    locationText: optionalText(200),
    city: optionalText(80),
    district: optionalText(80),
    budgetMin: z.coerce.number().nonnegative().max(100_000_000),
    budgetMax: z.coerce.number().nonnegative().max(100_000_000),
    scheduledFor: z.coerce.date(),
    urgency: JobUrgencySchema,
    taskSize: TaskSizeSchema,
    vehicleRequirement: VehicleRequirementSchema,
  })
  .partial();

// --- Quotes ---
// Standard Sri Lanka VAT, applied only when a (VAT-registered) tradesman opts in.
export const VAT_RATE = 18;

export const QuoteLineCategorySchema = z.enum(['LABOUR', 'MATERIAL']);

const QuoteLineItemSchema = z.object({
  category: QuoteLineCategorySchema,
  name: z.string().trim().min(1).max(160),
  quantity: z.coerce.number().positive().max(100_000).default(1),
  unit: z.string().trim().max(16).optional(),
  unitPrice: z.coerce.number().nonnegative().max(100_000_000).default(0),
});

// The total is built from the line items (labour + materials) plus an optional
// call-out fee, discount and VAT — all computed server-side, so the client only
// sends the inputs. The deposit cap is re-enforced server-side too.
export const CreateQuoteSchema = z.object({
  lineItems: z.array(QuoteLineItemSchema).min(1).max(60),
  calloutFee: z.coerce.number().nonnegative().max(100_000_000).optional(),
  discount: z.coerce.number().nonnegative().max(100_000_000).optional(),
  applyVat: z.coerce.boolean().default(false),
  validityDays: z.coerce.number().int().min(1).max(90).default(14),
  depositRequested: z.coerce.number().nonnegative().max(100_000_000).optional(),
  currency: z.string().trim().length(3).default('LKR'),
  message: optionalText(2000),
  estimatedStart: z.coerce.date().optional(),
  estimatedCompletion: z.coerce.date().optional(),
});

// Computes a quote's money breakdown from its line items + adjustments. Shared
// so the submit form's live preview and the backend agree exactly.
export interface QuoteLineInput {
  category: 'LABOUR' | 'MATERIAL';
  quantity: number;
  unitPrice: number;
}

export function computeQuoteTotals(
  lines: QuoteLineInput[],
  opts: { calloutFee?: number; discount?: number; applyVat?: boolean },
) {
  const sumBy = (cat: 'LABOUR' | 'MATERIAL') =>
    lines
      .filter((l) => l.category === cat)
      .reduce(
        (s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
        0,
      );
  const labour = sumBy('LABOUR');
  const materials = sumBy('MATERIAL');
  const callout = opts.calloutFee ?? 0;
  const discount = opts.discount ?? 0;
  const subtotal = Math.max(0, labour + materials + callout - discount);
  const vat = opts.applyVat ? (subtotal * VAT_RATE) / 100 : 0;
  return {
    labour,
    materials,
    callout,
    discount,
    subtotal,
    vat,
    total: subtotal + vat,
  };
}

// --- Mid-job material requests ---
// The assigned tradesman asks the homeowner for extra materials/tools partway
// through a job; estimatedCost is an optional figure for the homeowner's context.
export const CreateMaterialRequestSchema = z.object({
  note: z.string().trim().min(3).max(1000),
  estimatedCost: z.coerce.number().nonnegative().max(100_000_000).optional(),
  currency: z.string().trim().length(3).default('LKR'),
});

// --- Escrow / materials deposit ---
// Trust ladder mirrored from the design system (escrow.jsx): how large a
// materials deposit a tradesman may request. The deposit is always escrowed and
// capped both by the tier and by the quoted materials line. Shared so the
// frontend eligibility UI and the backend guard agree exactly.
export type DepositTierKey = 'none' | 'verified' | 'trusted' | 'background';

export interface DepositTier {
  key: DepositTierKey;
  label: string;
  pct: number;
  cap: number;
}

export interface TradesmanTrust {
  verified: boolean;
  rating: number;
  completed: number;
  bgChecked: boolean;
}

export function depositTier({
  verified,
  rating,
  completed,
  bgChecked,
}: TradesmanTrust): DepositTier {
  if (!verified)
    return { key: 'none', label: 'Not yet eligible', pct: 0, cap: 0 };
  if (bgChecked && rating >= 4.7 && completed >= 50)
    return {
      key: 'background',
      label: 'Background-checked',
      pct: 40,
      cap: 75_000,
    };
  if (rating >= 4.5 && completed >= 20)
    return { key: 'trusted', label: 'Trusted', pct: 30, cap: 40_000 };
  return { key: 'verified', label: 'Verified', pct: 20, cap: 15_000 };
}

// The largest deposit this tradesman may request on this quote: tier % of the
// quote total, capped by the tier, and never above the materials line.
export function maxDeposit(
  trust: TradesmanTrust,
  quoteTotal: number,
  materialsAmount: number,
): number {
  const tier = depositTier(trust);
  const byTier = Math.min(Math.round((tier.pct / 100) * quoteTotal), tier.cap);
  return Math.max(0, Math.min(byTier, materialsAmount));
}

export const EscrowPaymentMethodSchema = z.enum(['card', 'paypal', 'local']);
export const FundEscrowSchema = z.object({
  paymentMethod: EscrowPaymentMethodSchema.default('card'),
});

// --- Tradesman verification (KYC onboarding) ---
// Document fields hold storage references (keys/URLs); the binary upload is a
// separate concern. Only identity essentials are required so a tradesman can
// resubmit incrementally.
const docKey = () => z.string().trim().max(500).optional();

export const SubmitVerificationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  gender: z.string().trim().max(20).optional(),
  dateOfBirth: z.coerce.date().optional(),
  nicNumber: z.string().trim().min(5).max(20),
  addressLine: optionalText(200),
  city: optionalText(80),
  district: optionalText(80),
  primaryTrade: optionalText(80),
  yearsExperience: z.coerce.number().int().min(0).max(80).default(0),
  nicFrontKey: docKey(),
  nicBackKey: docKey(),
  photoKey: docKey(),
  gramaNiladhariKey: docKey(),
  licenceKey: docKey(),
  licenceNumber: optionalText(80),
  policeClearanceKey: docKey(),
  serviceRadiusKm: z.coerce.number().int().min(0).max(500).default(15),
  crewType: z.enum(['solo', 'team']).optional(),
  helperCount: z.coerce.number().int().min(0).max(50).optional(),
  portfolioKeys: z.array(z.string().trim().max(500)).max(10).optional(),
  guarantorName: optionalText(120),
  guarantorNic: optionalText(20),
  voiceIntroKey: docKey(),
  payoutAccountHolder: optionalText(120),
  payoutBank: optionalText(80),
  payoutBranch: optionalText(80),
  payoutAccountNumber: optionalText(40),
});

export const RejectVerificationSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});

// --- Reviews (marketplace, job-linked) ---
export const CreateReviewSchema = z.object({
  jobId: id,
  rating: z.coerce.number().int().min(1).max(5),
  title: optionalText(120),
  comment: optionalText(2000),
});

export const UpdateReviewSchema = CreateReviewSchema.pick({
  rating: true,
  title: true,
  comment: true,
}).partial();

// --- Conversations + Messages (chat) ---
// A direct conversation is created on the fly when sending the first message
// between two users; job-linked conversations target a Job and pull the
// counterpart from the job (homeowner ↔ accepted tradesman / quoter).
export const StartConversationSchema = z
  .object({
    type: z.enum(['JOB_DIRECT', 'DIRECT']).default('JOB_DIRECT'),
    jobId: id.optional(),
    recipientId: id.optional(),
    body: z.string().trim().min(1).max(4000),
    messageType: MessageTypeSchema.default('TEXT'),
  })
  .refine((v) => v.jobId !== undefined || v.recipientId !== undefined, {
    message: 'Either jobId or recipientId is required',
    path: ['jobId'],
  });

export const SendMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  messageType: MessageTypeSchema.default('TEXT'),
});

// --- Reports (moderation) ---
export const CreateReportSchema = z.object({
  targetType: ReportTargetTypeSchema,
  targetId: id,
  reason: z.string().trim().min(10).max(2000),
});

export const UpdateReportSchema = z
  .object({
    status: ReportStatusSchema,
    assigneeId: id.nullable(),
    resolutionNotes: z.string().trim().max(2000).nullable(),
  })
  .partial();

// Inferred types for reuse across apps + backend DTOs
export type HomeownerProfileInput = z.infer<typeof HomeownerProfileSchema>;
export type TradesmanProfileInput = z.infer<typeof TradesmanProfileSchema>;
export type CreateJobInput = z.infer<typeof CreateJobSchema>;
export type UpdateJobInput = z.infer<typeof UpdateJobSchema>;
export type CreateQuoteInput = z.infer<typeof CreateQuoteSchema>;
export type CreateMaterialRequestInput = z.infer<
  typeof CreateMaterialRequestSchema
>;
export type FundEscrowInput = z.infer<typeof FundEscrowSchema>;
export type EscrowPaymentMethod = z.infer<typeof EscrowPaymentMethodSchema>;
export type SubmitVerificationInput = z.infer<typeof SubmitVerificationSchema>;
export type RejectVerificationInput = z.infer<typeof RejectVerificationSchema>;
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>;
export type StartConversationInput = z.infer<typeof StartConversationSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type CreateReportInput = z.infer<typeof CreateReportSchema>;
export type UpdateReportInput = z.infer<typeof UpdateReportSchema>;
