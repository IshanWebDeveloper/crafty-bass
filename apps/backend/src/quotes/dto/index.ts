import { createZodDto } from 'nestjs-zod';
import { CreateQuoteSchema, RejectQuoteSchema } from '@repo/validation';

export class CreateQuoteDto extends createZodDto(CreateQuoteSchema) {}

export class RejectQuoteDto extends createZodDto(RejectQuoteSchema) {}
