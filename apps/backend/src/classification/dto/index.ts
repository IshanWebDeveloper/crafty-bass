import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { LanguageCodeSchema } from '@repo/validation';

// Request: the free-text a homeowner has typed so far. Kept lenient (min 3 on
// the title, min 10 on the description) so the "detect as you type" call can
// fire as soon as there is something worth classifying.
const ClassifyJobSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(5000),
  language: LanguageCodeSchema.default('EN'),
});

export class ClassifyJobDto extends createZodDto(ClassifyJobSchema) {}

// Response: the model's prediction mapped back onto real catalog rows. category
// is null when the model couldn't confidently match one; skills lists whichever
// suggested skill slugs resolved to a seeded Skill.
const ClassifyJobResponseSchema = z.object({
  category: z
    .object({ id: z.string(), slug: z.string(), nameEn: z.string() })
    .nullable(),
  skills: z.array(
    z.object({ id: z.string(), slug: z.string(), nameEn: z.string() }),
  ),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  model: z.string(),
});

export class ClassifyJobResponseDto extends createZodDto(
  ClassifyJobResponseSchema,
) {}
