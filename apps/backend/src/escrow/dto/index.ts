import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { FundEscrowSchema, ResolveDisputeSchema } from '@repo/validation';

export class FundEscrowDto extends createZodDto(FundEscrowSchema) {}

export class ResolveDisputeDto extends createZodDto(ResolveDisputeSchema) {}

// ─── Admin Escrow List Query ────────────────────────────────────────────────

const EscrowListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum([
      'REQUESTED',
      'FUNDED',
      'MATERIALS_RELEASED',
      'WORK_COMPLETED',
      'RELEASED',
      'REFUNDED',
      'CANCELLED',
    ])
    .optional(),
});

export class EscrowListQueryDto extends createZodDto(EscrowListQuerySchema) {}
