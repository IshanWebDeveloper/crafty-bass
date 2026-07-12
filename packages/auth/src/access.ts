import { createAccessControl } from 'better-auth/plugins/access';
import {
  defaultStatements,
  userAc,
  adminAc,
} from 'better-auth/plugins/admin/access';

// Marketplace RBAC. Roles are CUSTOMER / SUPPORT / ADMIN; the homeowner vs.
// tradesman distinction is carried by User.userType and enforced at the service
// layer (ownership + userType checks), not by a dedicated better-auth role.
export const statements = {
  profile: ['view', 'edit', 'verify'],
  job: ['create', 'view', 'list', 'edit', 'cancel', 'assign'],
  quote: ['create', 'view', 'list', 'accept', 'reject', 'withdraw', 'edit'],
  escrow: ['view', 'fund', 'release', 'approve', 'refund'],
  conversation: ['create', 'view', 'list'],
  message: ['create', 'view', 'list'],
  review: ['create', 'update', 'delete', 'view', 'moderate'],
  report: ['create', 'view', 'list', 'moderate', 'resolve'],
  recommendation: ['view', 'list'],
  category: ['create', 'update', 'delete', 'view', 'list'],
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

// CUSTOMER covers both homeowners and tradesmen. Capability differences
// (e.g. who can create a job vs. submit a quote) are enforced in services via
// User.userType + record ownership.
export const customer = ac.newRole({
  ...userAc.statements,
  profile: ['view', 'edit'],
  job: ['create', 'view', 'list', 'edit', 'cancel'],
  quote: ['create', 'view', 'list', 'accept', 'reject', 'withdraw', 'edit'],
  escrow: ['view', 'fund', 'release', 'approve', 'refund'],
  conversation: ['create', 'view', 'list'],
  message: ['create', 'view', 'list'],
  review: ['create', 'update', 'delete', 'view'],
  report: ['create', 'view'],
  recommendation: ['view', 'list'],
  category: ['view', 'list'],
  user: ['view'],
});

export const support = ac.newRole({
  ...userAc.statements,
  profile: ['view', 'verify'],
  job: ['view', 'list'],
  quote: ['view', 'list'],
  escrow: ['view', 'refund'],
  conversation: ['view', 'list'],
  message: ['view', 'list'],
  review: ['view', 'moderate'],
  report: ['view', 'list', 'moderate', 'resolve'],
  recommendation: ['view', 'list'],
  category: ['view', 'list'],
  user: ['view'],
});

export const admin = ac.newRole({
  ...adminAc.statements,
  ...mutableStatements,
});
