import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  AdminUpdatableOrderStatusSchema,
  OrderStatusSchema,
} from '@repo/shared-types';
import { ShippingAddressSchema } from '@repo/validation';

// ─── Create Order (Checkout) ────────────────────────────────────────────────

const CreateOrderSchema = z.object({
  shippingAddress: ShippingAddressSchema,
  promotionId: z.string().optional(),
  promotionCode: z.string().optional(),
  couponCode: z.string().optional(),
});

export class CreateOrderDto extends createZodDto(CreateOrderSchema) {}

// ─── Coupon Validation ─────────────────────────────────────────────────────

const ValidateCouponSchema = z.object({
  code: z.string().trim().min(3).max(32),
});

export class ValidateCouponDto extends createZodDto(ValidateCouponSchema) {}

// ─── Coupon Admin CRUD ─────────────────────────────────────────────────────

const CouponDiscountTypeSchema = z.enum(['PERCENTAGE', 'FIXED']);

const CouponBaseSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(
        /^[A-Za-z0-9_-]+$/,
        'Coupon code can only contain letters, numbers, _ and -',
      ),
    description: z.string().max(500).optional(),
    discountType: CouponDiscountTypeSchema,
    discountValue: z.coerce.number().positive(),
    minOrderAmount: z.coerce.number().nonnegative().optional(),
    maxDiscountAmount: z.coerce.number().positive().optional(),
    usageLimit: z.coerce.number().int().positive().optional(),
    usageLimitPerUser: z.coerce.number().int().positive().optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) =>
      data.startsAt === undefined ||
      data.endsAt === undefined ||
      new Date(data.endsAt) > new Date(data.startsAt),
    {
      message: 'endsAt must be after startsAt',
      path: ['endsAt'],
    },
  )
  .refine(
    (data) => data.discountType !== 'PERCENTAGE' || data.discountValue <= 100,
    {
      message: 'Percentage discount cannot be greater than 100',
      path: ['discountValue'],
    },
  );

const CreateCouponSchema = CouponBaseSchema;

export class CreateCouponDto extends createZodDto(CreateCouponSchema) {}

const UpdateCouponSchema = CouponBaseSchema.refine(
  (data) =>
    data.startsAt === undefined ||
    data.endsAt === undefined ||
    new Date(data.endsAt) > new Date(data.startsAt),
  {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  },
);

export class UpdateCouponDto extends createZodDto(UpdateCouponSchema) {}

const CouponQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

export class CouponQueryDto extends createZodDto(CouponQuerySchema) {}

// ─── Update Order Status (Admin) ────────────────────────────────────────────

const UpdateOrderStatusSchema = z.object({
  status: AdminUpdatableOrderStatusSchema,
  trackingNumber: z.string().optional(),
});

export class UpdateOrderStatusDto extends createZodDto(
  UpdateOrderStatusSchema,
) {}

const CancelOrderSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export class CancelOrderDto extends createZodDto(CancelOrderSchema) {}

// ─── Order Query ────────────────────────────────────────────────────────────

const OrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: OrderStatusSchema.optional(),
});

export class OrderQueryDto extends createZodDto(OrderQuerySchema) {}
