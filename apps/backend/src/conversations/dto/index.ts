import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { StartConversationSchema, SendMessageSchema } from '@repo/validation';

export class StartConversationDto extends createZodDto(
  StartConversationSchema,
) {}
export class SendMessageDto extends createZodDto(SendMessageSchema) {}

const ConversationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const MessageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export class ConversationQueryDto extends createZodDto(
  ConversationQuerySchema,
) {}
export class MessageQueryDto extends createZodDto(MessageQuerySchema) {}
