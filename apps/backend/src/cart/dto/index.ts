import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ─── Add Cart Item ──────────────────────────────────────────────────────────

const AddCartItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).default(1),
});

export class AddCartItemDto extends createZodDto(AddCartItemSchema) {}

// ─── Update Cart Item ───────────────────────────────────────────────────────

const UpdateCartItemSchema = z.object({
  quantity: z.number().int().min(1),
});

export class UpdateCartItemDto extends createZodDto(UpdateCartItemSchema) {}
