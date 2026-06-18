import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  CreateReportSchema,
  UpdateReportSchema,
  ReportStatusSchema,
  ReportTargetTypeSchema,
} from '@repo/validation';

export class CreateReportDto extends createZodDto(CreateReportSchema) {}
export class UpdateReportDto extends createZodDto(UpdateReportSchema) {}

const ReportQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: ReportStatusSchema.optional(),
  targetType: ReportTargetTypeSchema.optional(),
  assigneeId: z.string().min(1).optional(),
});

export class ReportQueryDto extends createZodDto(ReportQuerySchema) {}
