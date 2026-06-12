import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Role } from '@repo/db';

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
