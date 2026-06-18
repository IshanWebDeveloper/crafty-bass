import base from './base.js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(...base, ...tseslint.configs.recommended, {
  files: ['**/*.{ts,tsx}'],
  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node,
    },
  },
});
