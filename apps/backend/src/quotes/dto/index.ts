import { createZodDto } from 'nestjs-zod';
import { CreateQuoteSchema } from '@repo/validation';

export class CreateQuoteDto extends createZodDto(CreateQuoteSchema) {}
