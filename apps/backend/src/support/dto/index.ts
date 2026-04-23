import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { TicketStatusSchema, TicketPrioritySchema } from '@repo/shared-types';
import { CreateTicketSchema, AddTicketMessageSchema } from '@repo/validation';

// Re-export shared schemas wrapped as NestJS DTOs
export class CreateTicketDto extends createZodDto(CreateTicketSchema) {}

export class AddMessageDto extends createZodDto(AddTicketMessageSchema) {}

// ─── Update Ticket Status (Agent/Admin) ─────────────────────────────────────

const UpdateTicketStatusSchema = z.object({
  status: TicketStatusSchema,
});

export class UpdateTicketStatusDto extends createZodDto(
  UpdateTicketStatusSchema,
) {}

// ─── Assign Ticket ──────────────────────────────────────────────────────────

const AssignTicketSchema = z.object({
  agentId: z.string(),
});

export class AssignTicketDto extends createZodDto(AssignTicketSchema) {}

// ─── Return Approval Workflow ──────────────────────────────────────────────

const RequestReturnApprovalSchema = z.object({
  note: z.string().trim().min(1).max(1000).optional(),
});

export class RequestReturnApprovalDto extends createZodDto(
  RequestReturnApprovalSchema,
) {}

const ReviewReturnApprovalSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().trim().min(1).max(1000).optional(),
});

export class ReviewReturnApprovalDto extends createZodDto(
  ReviewReturnApprovalSchema,
) {}

// ─── Ticket Query ───────────────────────────────────────────────────────────

const TicketQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: TicketStatusSchema.optional(),
  priority: TicketPrioritySchema.optional(),
});

export class TicketQueryDto extends createZodDto(TicketQuerySchema) {}
