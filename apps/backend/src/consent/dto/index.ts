import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const ConsentPayloadSchema = z.record(z.string(), z.unknown());

const UpsertConsentSchema = z.object({
  consentVersion: z.string().min(1).max(64).optional(),
  consentPayload: ConsentPayloadSchema.optional(),
  grantedAt: z.string().datetime().optional(),
});

export class UpsertConsentDto extends createZodDto(UpsertConsentSchema) {}
