import { createZodDto } from 'nestjs-zod';
import {
  CreateMaterialRequestSchema,
  DeclineMaterialRequestSchema,
} from '@repo/validation';

export class CreateMaterialRequestDto extends createZodDto(
  CreateMaterialRequestSchema,
) {}

export class DeclineMaterialRequestDto extends createZodDto(
  DeclineMaterialRequestSchema,
) {}
