module.exports = {
  preset: 'ts-jest',
  testEnvironment: './FixJSDOMEnvironment.ts',
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@metaflow/(.*)$': '<rootDir>/src/$1',
    '^obsidian$': '<rootDir>/__mocks__/obsidian.ts',
  },
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!*.d.ts',
    '!jest.config.js',
    '!esbuild.config.mjs',
    "!src/settings/**",
    "!src/ui/**"
  ],
  collectCoverage: true,
  coverageReporters: ["json", "html"],
  globals: {
    window: {}
  }
};
