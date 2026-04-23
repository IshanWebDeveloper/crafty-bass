import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { RoleSchema, PaymentMethodSchema } from '@repo/shared-types';
import { ShippingAddressSchema } from '@repo/validation';

// ─── Update Profile ─────────────────────────────────────────────────────────

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().min(5).max(20).optional(),
  shippingAddress: ShippingAddressSchema.optional(),
  paymentPreferences: z
    .object({
      preferredMethod: PaymentMethodSchema.optional(),
    })
    .optional(),
});

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}

// ─── Update User Role (Admin) ───────────────────────────────────────────────

const UpdateUserRoleSchema = z.object({
  role: RoleSchema,
});

export class UpdateUserRoleDto extends createZodDto(UpdateUserRoleSchema) {}

// ─── User Response ──────────────────────────────────────────────────────────

const UserResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  role: z.string(),
  phone: z.string().nullable(),
  shippingAddress: z.unknown().nullable(),
  paymentPreferences: z.unknown().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export class UserResponseDto extends createZodDto(UserResponseSchema) {}

// ─── User List Query ────────────────────────────────────────────────────────

const UserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: RoleSchema.optional(),
  search: z.string().optional(),
});

export class UserListQueryDto extends createZodDto(UserListQuerySchema) {}

// ─── Dashboard Response ─────────────────────────────────────────────────────

const DashboardResponseSchema = z.object({
  recentOrders: z.array(z.unknown()),
  wishlistCount: z.number(),
  totalOrders: z.number(),
  pendingOrders: z.number(),
});

export class DashboardResponseDto extends createZodDto(
  DashboardResponseSchema,
) {}
