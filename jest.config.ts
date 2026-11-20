import type {Config} from 'jest';

const config: Config = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': '<rootDir>/tests/esbuild-jest-transform.cjs',
  },
  testMatch: ['**/tests/**/*.test.ts'],
};

export default config;
