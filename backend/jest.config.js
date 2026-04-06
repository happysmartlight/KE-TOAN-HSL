/** @type {import('jest').Config} */
module.exports = {
  projects: [
    // ── Unit tests: mock Prisma, no DB needed ──
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['**/__tests__/unit/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { strict: false } }] },
      moduleFileExtensions: ['ts', 'js', 'json'],
      clearMocks: true,
    },

    // ── System tests: real test DB + supertest ──
    {
      displayName: 'system',
      testEnvironment: 'node',
      testMatch: ['**/__tests__/system/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { strict: false } }] },
      moduleFileExtensions: ['ts', 'js', 'json'],
      globalSetup: './__tests__/setup/globalSetup.ts',
      globalTeardown: './__tests__/setup/globalTeardown.ts',
      setupFiles: ['./__tests__/setup/setEnv.ts'],
      clearMocks: true,
      testTimeout: 30000,
    },
  ],
};
