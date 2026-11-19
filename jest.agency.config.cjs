module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/agency/**/*.spec.ts'],
  setupFiles: ['<rootDir>/tests/agency/setup.cjs'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { target: 'ES2021', module: 'CommonJS', esModuleInterop: true, experimentalDecorators: true, emitDecoratorMetadata: true, resolveJsonModule: true, skipLibCheck: true }, diagnostics: false }] },
  moduleNameMapper: {
    '^@gitroom/nestjs-libraries/(.*)$': '<rootDir>/libraries/nestjs-libraries/src/$1',
    '^@gitroom/helpers/(.*)$': '<rootDir>/libraries/helpers/src/$1',
    '^@gitroom/backend/(.*)$': '<rootDir>/apps/backend/src/$1',
    '^@gitroom/orchestrator/(.*)$': '<rootDir>/apps/orchestrator/src/$1',
  },
  testTimeout: 30000,
};
