import { createZodDto } from 'nestjs-zod';
import {
  HomeownerProfileSchema,
  TradesmanProfileSchema,
} from '@repo/validation';

export class UpsertHomeownerProfileDto extends createZodDto(
  HomeownerProfileSchema,
) {}

export class UpsertTradesmanProfileDto extends createZodDto(
  TradesmanProfileSchema,
) {}
