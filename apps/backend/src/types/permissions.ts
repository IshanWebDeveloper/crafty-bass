import { statements } from '../auth-access.js';

export type Entities = keyof typeof statements;
export type PermissionFor<E extends Entities> = (typeof statements)[E][number];
