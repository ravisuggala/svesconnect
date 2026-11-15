import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'bvritn-main', 'svecw-main']),
  {
    files: ['src/**/*.{js,jsx}'],
    extends: [js.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: { ecmaVersion: 'latest', ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    rules: { 'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', args: 'none', caughtErrors: 'none' }] },
  },
  {
    // Legacy document-portal code, ported as-is: keep these as warnings, not errors.
    files: ['src/pages/Documents.jsx'],
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['server/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: globals.node },
  },
])
