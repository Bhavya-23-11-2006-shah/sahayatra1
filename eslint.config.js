export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}', 'server.ts'],
    rules: {
      'no-console': ['warn', {allow: ['warn', 'error']}],
      'prefer-const': 'error',
    },
  },
];
