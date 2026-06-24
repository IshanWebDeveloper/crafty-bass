import { createZodDto } from 'nestjs-zod';
import { FundEscrowSchema } from '@repo/validation';

export class FundEscrowDto extends createZodDto(FundEscrowSchema) {}
