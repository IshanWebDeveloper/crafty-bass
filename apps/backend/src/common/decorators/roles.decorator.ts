import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../generated/prisma/enums';

export const ROLES_KEY = 'ROLES';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
