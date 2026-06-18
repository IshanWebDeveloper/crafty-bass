import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdatePrivacyPolicySchema = z.object({
  title: z.string().min(3).max(200).optional(),
  version: z.string().min(1).max(64),
  content: z.string().min(32),
});

export class UpdatePrivacyPolicyDto extends createZodDto(
  UpdatePrivacyPolicySchema,
) {}
