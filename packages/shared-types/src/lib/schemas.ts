import { z } from 'zod';

import { Role } from './prisma-types.js';

export const RoleSchema = z.nativeEnum(Role);

export const PaymentMethodSchema = z.enum([
  'CARD',
  'BANK_TRANSFER',
  'CASH_ON_DELIVERY',
  'CASH',
]);

export const OrderStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
]);

export const AdminUpdatableOrderStatusSchema = OrderStatusSchema.exclude([
  'PENDING',
]);

export const TicketStatusSchema = z.enum([
  'OPEN',
  'PENDING',
  'RESOLVED',
  'CLOSED',
]);

export const TicketPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
