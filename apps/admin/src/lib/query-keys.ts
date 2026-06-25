// Query-key factory (qk-factory-pattern). Centralizing keys keeps them
// hierarchical and serializable, and lets callers invalidate a whole subtree
// (e.g. `adminKeys.stats()`) after a moderation action without hunting down
// every individual key string.
export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  openReports: () => [...adminKeys.stats(), 'open-reports'] as const,
  pendingVerifications: () =>
    [...adminKeys.stats(), 'pending-verifications'] as const,
  activeJobs: () => [...adminKeys.stats(), 'active-jobs'] as const,
};
