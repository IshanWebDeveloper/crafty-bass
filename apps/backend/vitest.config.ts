import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    include: ['src/**/*.vitest.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage-vitest',
      exclude: [
        'test/**',
        '**/*.spec.ts',
        '**/*.test.ts',
        'src/**/dto/**',
        'src/**/*.module.ts',
        'src/main.ts',
        '**/*.config.ts',
      ],
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2021',
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
      },
    }) as any,
  ],
});
