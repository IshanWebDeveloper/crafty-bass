import config from '@repo/eslint-config/package';

export default [
  ...config,
  {
    // shadcn's monorepo generator writes self-package imports inside @repo/ui
    // (e.g. `@repo/ui/lib/utils`). That's the documented shadcn pattern, but it
    // trips @nx/enforce-module-boundaries' "use relative imports within a
    // project" check. Disable the rule for this package only so `shadcn add`
    // output lints cleanly; apps keep full boundary enforcement.
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      '@nx/enforce-module-boundaries': 'off',
    },
  },
];
