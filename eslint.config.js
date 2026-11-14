import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      // Engine stubs take `_name` parameters until they are implemented.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // UI rule: colours and fonts come from tokens in src/index.css, never hex literals in code.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
          message:
            'No hex colours in code. Add a token in src/index.css and use its Tailwind class.',
        },
        {
          selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]',
          message:
            'No hex colours in code. Add a token in src/index.css and use its Tailwind class.',
        },
      ],
      // CLAUDE.md rule 7: all randomness goes through src/engine/rng.ts.
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'Math.random() is banned. Use createRng(seed) from "@/engine/rng" so runs are reproducible.',
        },
      ],
    },
  },
  {
    // CLAUDE.md rule 1: the engine is pure TypeScript and never imports React or UI layers.
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-dom',
                'react/*',
                'react-dom/*',
                '@/screens/*',
                '@/ui/*',
                '@/store/*',
                '@/nova/*',
                '@/controlroom/*',
                '**/screens/**',
                '**/ui/**',
                '**/store/**',
                '**/nova/**',
                '**/controlroom/**',
              ],
              message:
                'src/engine/ must stay pure TypeScript: no React and no imports from screens, ui, store, nova or controlroom.',
            },
          ],
        },
      ],
    },
  },
])
