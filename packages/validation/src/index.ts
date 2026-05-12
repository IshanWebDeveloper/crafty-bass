import { z } from 'zod';

export const ShippingAddressSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(160),
  line2: z.string().trim().max(160).optional(),
  city: z.string().trim().min(1).max(80),
  district: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().min(2).max(80).default('Sri Lanka'),
  phone: z.string().trim().min(5).max(32).optional(),
});

export const CreateReviewSchema = z.object({
  jobId: z.string().min(1).optional(),
  productId: z.string().min(1).optional(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  comment: z.string().trim().max(2000).optional(),
});

export const UpdateReviewSchema = CreateReviewSchema.pick({
  rating: true,
  title: true,
  comment: true,
}).partial();

export const CreateTicketSchema = z.object({
  subject: z.string().trim().min(1).max(160),
  message: z.string().trim().min(1).max(4000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  orderId: z.string().min(1).optional(),
});

export const AddTicketMessageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});
