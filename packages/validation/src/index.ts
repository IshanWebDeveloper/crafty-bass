import { z } from 'zod';

// Shared enums (mirror packages/db/prisma/schema.prisma)
export const LanguageCodeSchema = z.enum(['EN', 'SI', 'TA']);
export const JobUrgencySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY']);
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
    budgetMin: z.coerce.number().nonnegative().max(100_000_000).optional(),
    budgetMax: z.coerce.number().nonnegative().max(100_000_000).optional(),
    scheduledFor: z.coerce.date().optional(),
    urgency: JobUrgencySchema.default('MEDIUM'),
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
  })
  .partial();

// --- Quotes ---
export const CreateQuoteSchema = z.object({
  amount: z.coerce.number().positive().max(100_000_000),
  currency: z.string().trim().length(3).default('LKR'),
  message: optionalText(2000),
  estimatedStart: z.coerce.date().optional(),
  estimatedCompletion: z.coerce.date().optional(),
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

// Inferred types for reuse across apps + backend DTOs
export type HomeownerProfileInput = z.infer<typeof HomeownerProfileSchema>;
export type TradesmanProfileInput = z.infer<typeof TradesmanProfileSchema>;
export type CreateJobInput = z.infer<typeof CreateJobSchema>;
export type UpdateJobInput = z.infer<typeof UpdateJobSchema>;
export type CreateQuoteInput = z.infer<typeof CreateQuoteSchema>;
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>;
export type StartConversationInput = z.infer<typeof StartConversationSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
