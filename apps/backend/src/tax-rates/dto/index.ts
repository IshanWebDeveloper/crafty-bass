import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateTaxRateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  rate: z.coerce.number().positive().max(1),
  country: z.string().trim().max(100).optional(),
  isActive: z.boolean().default(true),
});

export class CreateTaxRateDto extends createZodDto(CreateTaxRateSchema) {}

const UpdateTaxRateSchema = CreateTaxRateSchema.partial();

export class UpdateTaxRateDto extends createZodDto(UpdateTaxRateSchema) {}
