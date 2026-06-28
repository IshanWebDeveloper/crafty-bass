import { createZodDto } from 'nestjs-zod';
import { CreateMaterialRequestSchema } from '@repo/validation';

export class CreateMaterialRequestDto extends createZodDto(
  CreateMaterialRequestSchema,
) {}
