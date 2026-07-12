import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Supported UI locales - the target the content is translated *into*.
export const LOCALES = ['en', 'si', 'ta'] as const;

const TranslateSchema = z.object({
  text: z.string().min(1).max(5000),
  targetLocale: z.enum(LOCALES),
  sourceLocale: z.enum(LOCALES).optional(),
});

export class TranslateDto extends createZodDto(TranslateSchema) {}

const TranslateResponseSchema = z.object({
  translatedText: z.string(),
  model: z.string(),
});

export class TranslateResponseDto extends createZodDto(
  TranslateResponseSchema,
) {}
