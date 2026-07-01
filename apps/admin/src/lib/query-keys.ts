// Query-key factory (qk-factory-pattern). Centralizing keys keeps them
// hierarchical and serializable, and lets callers invalidate a whole subtree
// (e.g. `adminKeys.users()`) after a mutation without hunting down every
// individual key string.
export const adminKeys = {
  all: ['admin'] as const,

  metrics: () => [...adminKeys.all, 'metrics'] as const,

  // Legacy overview count cards (kept as a fallback alongside `metrics`).
  stats: () => [...adminKeys.all, 'stats'] as const,
  openReports: () => [...adminKeys.stats(), 'open-reports'] as const,
  pendingVerifications: () =>
    [...adminKeys.stats(), 'pending-verifications'] as const,
  activeJobs: () => [...adminKeys.stats(), 'active-jobs'] as const,

  users: () => [...adminKeys.all, 'users'] as const,
  usersList: (params: unknown) =>
    [...adminKeys.users(), 'list', params] as const,
  user: (id: string) => [...adminKeys.users(), 'detail', id] as const,

  reports: () => [...adminKeys.all, 'reports'] as const,
  reportsList: (params: unknown) =>
    [...adminKeys.reports(), 'list', params] as const,
  report: (id: string) => [...adminKeys.reports(), 'detail', id] as const,

  verifications: () => [...adminKeys.all, 'verifications'] as const,
  verificationsList: (params: unknown) =>
    [...adminKeys.verifications(), 'list', params] as const,
  verification: (id: string) =>
    [...adminKeys.verifications(), 'detail', id] as const,
  verificationDocs: (id: string) =>
    [...adminKeys.verifications(), 'documents', id] as const,

  reviews: () => [...adminKeys.all, 'reviews'] as const,
  reviewsList: (params: unknown) =>
    [...adminKeys.reviews(), 'list', params] as const,

  jobs: () => [...adminKeys.all, 'jobs'] as const,
  jobsList: (params: unknown) => [...adminKeys.jobs(), 'list', params] as const,
  job: (id: string) => [...adminKeys.jobs(), 'detail', id] as const,

  escrows: () => [...adminKeys.all, 'escrows'] as const,
  escrowsList: (params: unknown) =>
    [...adminKeys.escrows(), 'list', params] as const,
  escrow: (id: string) => [...adminKeys.escrows(), 'detail', id] as const,

  auditLog: () => [...adminKeys.all, 'audit-log'] as const,
  auditLogList: (params: unknown) =>
    [...adminKeys.auditLog(), 'list', params] as const,

  categories: () => [...adminKeys.all, 'categories'] as const,

  privacyPolicy: () => [...adminKeys.all, 'privacy-policy'] as const,
};
