import { createAccessControl } from 'better-auth/plugins/access';
import {
  defaultStatements,
  userAc,
  adminAc,
} from 'better-auth/plugins/admin/access';

export const statements = {
  product: ['create', 'update', 'delete', 'view', 'list', 'view:<id>'],
  category: ['create', 'update', 'delete', 'view', 'list'],
  cart: ['view', 'checkout', 'add-item', 'remove-item'],
  order: ['create', 'update', 'cancel', 'process', 'ship', 'view', 'list'],
  coupon: ['create', 'update', 'delete', 'view', 'list'],
  payments: [
    'list',
    'checkout',
    'request-refund',
    'mock-confirm',
    'refund',
    'view',
  ],
  review: ['create', 'update', 'delete', 'view', 'moderate'],
  ticket: ['create', 'assign', 'resolve', 'close', 'view', 'reply'],
  user: ['create', 'view', 'ban', 'list', 'set-role'],
} as const;

type MutableStatements<T extends Record<string, readonly string[]>> = {
  [K in keyof T]: Array<T[K][number]>;
};

const mutableStatements: MutableStatements<typeof statements> =
  Object.fromEntries(
    Object.entries(statements).map(([key, value]) => [key, [...value]]),
  ) as MutableStatements<typeof statements>;

export const ac = createAccessControl({
  ...defaultStatements,
  ...statements,
});

export const customer = ac.newRole({
  ...userAc.statements,
  product: ['view', 'list'],
  category: ['view', 'list'],
  order: ['create', 'cancel', 'view', 'list'],
  payments: ['checkout', 'request-refund', 'refund', 'view'],
  cart: ['view', 'checkout', 'add-item', 'remove-item'],
  review: ['create', 'update', 'delete', 'view'],
  ticket: ['create', 'view', 'reply'],
  user: ['view'],
});

export const support = ac.newRole({
  ...userAc.statements,
  product: ['view', 'list'],
  category: ['view', 'list'],
  order: ['view', 'list'],
  review: ['view', 'moderate'],
  ticket: ['assign', 'resolve', 'close', 'view', 'reply'],
  user: ['view'],
});

export const admin = ac.newRole({
  ...adminAc.statements,
  ...mutableStatements,
});
