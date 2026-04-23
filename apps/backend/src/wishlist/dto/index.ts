import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const AddWishlistItemSchema = z.object({
  productId: z.string().uuid(),
});

export class AddWishlistItemDto extends createZodDto(AddWishlistItemSchema) {}
