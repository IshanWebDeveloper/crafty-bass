import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const NotificationTypeSchema = z.enum([
  'ORDER_UPDATE',
  'PAYMENT_UPDATE',
  'TICKET_UPDATE',
  'PROMOTION',
  'PRICE_DROP',
  'SYSTEM',
]);

const CreateNotificationSchema = z.object({
  type: NotificationTypeSchema.default('SYSTEM'),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(500),
});

export class CreateNotificationDto extends createZodDto(
  CreateNotificationSchema,
) {}

const AdminCreateNotificationSchema = CreateNotificationSchema.extend({
  userId: z.string().trim().min(1),
});

export class AdminCreateNotificationDto extends createZodDto(
  AdminCreateNotificationSchema,
) {}

const AdminNotificationQuerySchema = z.object({
  userId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export class AdminNotificationQueryDto extends createZodDto(
  AdminNotificationQuerySchema,
) {}
