import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  CreateJobSchema,
  UpdateJobSchema,
  JobUrgencySchema,
  JobStatusSchema,
} from '@repo/validation';

export class CreateJobDto extends createZodDto(CreateJobSchema) {}
export class UpdateJobDto extends createZodDto(UpdateJobSchema) {}

const JobQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z.string().min(1).optional(),
  district: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  urgency: JobUrgencySchema.optional(),
  status: JobStatusSchema.optional(),
});

export class JobQueryDto extends createZodDto(JobQuerySchema) {}
