import { SetMetadata } from '@nestjs/common';
import { Entities, PermissionFor } from '../../types/permissions.js';

export const PERMISSIONS_KEY = 'PERMISSIONS';

export interface PermissionRequirement<E extends Entities> {
  entity: E;
  permissions: PermissionFor<E> | Array<PermissionFor<E>>;
}

export const Permissions = <E extends Entities>(
  entity: E,
  permissions: PermissionFor<E> | Array<PermissionFor<E>>,
) =>
  SetMetadata(PERMISSIONS_KEY, {
    entity,
    permissions,
  } as PermissionRequirement<E>);
