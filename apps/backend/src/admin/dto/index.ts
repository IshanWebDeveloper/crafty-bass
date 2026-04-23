import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PromotionRuleType, PromotionType, Role } from '@prisma/client';

const IsoDateStringSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Invalid date string',
  });

const DateRangeQuerySchema = z.object({
  startDate: IsoDateStringSchema.optional(),
  endDate: IsoDateStringSchema.optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

export class DateRangeQueryDto extends createZodDto(DateRangeQuerySchema) {}

const AuditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  entity: z.string().optional(),
  userId: z.string().optional(),
  entityId: z.string().optional(),
});

export class AuditLogQueryDto extends createZodDto(AuditLogQuerySchema) {}

const AdminCreateUserSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.email().trim(),
  password: z.string().min(8).max(128),
  role: z.enum(Role).default(Role.CUSTOMER),
});

export type AdminCreateUserInput = z.infer<typeof AdminCreateUserSchema>;

export class AdminCreateUserDto extends createZodDto(AdminCreateUserSchema) {}

const PromotionRuleSchema = z
  .object({
    ruleType: z.enum(PromotionRuleType),
    decimalValue: z.coerce.number().nonnegative().optional(),
    intValue: z.coerce.number().int().nonnegative().optional(),
    stringValue: z.string().trim().min(1).max(255).optional(),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (
      value.decimalValue === undefined &&
      value.intValue === undefined &&
      value.stringValue === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        message:
          'At least one of decimalValue, intValue, or stringValue is required',
      });
    }
  });

const PromotionBaseObjectSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(500).optional(),
  type: z.enum(PromotionType),
  value: z.coerce.number().nonnegative(),
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  minAmount: z.coerce.number().nonnegative().optional(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  isActive: z.boolean().default(true),
  rules: z.array(PromotionRuleSchema).default([]),
  flashProductIds: z.array(z.uuid()).default([]),
});

const PromotionBaseSchema = PromotionBaseObjectSchema.superRefine(
  (data, ctx) => {
    if (new Date(data.endsAt) <= new Date(data.startsAt)) {
      ctx.addIssue({
        code: 'custom',
        message: 'endsAt must be after startsAt',
        path: ['endsAt'],
      });
    }

    if (data.type === 'PERCENTAGE' && data.value > 100) {
      ctx.addIssue({
        code: 'custom',
        message: 'Percentage promotion value cannot be greater than 100',
        path: ['value'],
      });
    }

    if (data.type === 'FLASH_SALE' && data.flashProductIds.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Flash sale promotions must include at least one product',
        path: ['flashProductIds'],
      });
    }
  },
);

export type PromotionRuleInput = z.infer<typeof PromotionRuleSchema>;
export type CreatePromotionInput = z.infer<typeof PromotionBaseSchema>;

export class CreatePromotionDto extends createZodDto(PromotionBaseSchema) {}

const UpdatePromotionSchema = PromotionBaseObjectSchema.partial()
  .extend({
    startsAt: IsoDateStringSchema.optional(),
    endsAt: IsoDateStringSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startsAt && data.endsAt) {
      if (new Date(data.endsAt) <= new Date(data.startsAt)) {
        ctx.addIssue({
          code: 'custom',
          message: 'endsAt must be after startsAt',
          path: ['endsAt'],
        });
      }
    }

    if (
      data.type === 'PERCENTAGE' &&
      data.value !== undefined &&
      data.value > 100
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Percentage promotion value cannot be greater than 100',
        path: ['value'],
      });
    }

    if (
      data.type === 'FLASH_SALE' &&
      data.flashProductIds !== undefined &&
      data.flashProductIds.length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Flash sale promotions must include at least one product',
        path: ['flashProductIds'],
      });
    }
  });

export type UpdatePromotionInput = z.infer<typeof UpdatePromotionSchema>;

export class UpdatePromotionDto extends createZodDto(UpdatePromotionSchema) {}

const AdminPromotionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  isActive: z
    .string()
    .transform((value) => value === 'true')
    .optional(),
  type: z.enum(PromotionType).optional(),
});

export class AdminPromotionListQueryDto extends createZodDto(
  AdminPromotionListQuerySchema,
) {}
