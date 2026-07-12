import { createZodDto } from 'nestjs-zod';
import {
  SubmitVerificationSchema,
  RejectVerificationSchema,
} from '@repo/validation';

export class SubmitVerificationDto extends createZodDto(
  SubmitVerificationSchema,
) {}

export class RejectVerificationDto extends createZodDto(
  RejectVerificationSchema,
) {}
