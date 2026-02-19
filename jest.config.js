/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/tests'],
    testMatch: ['**/*.test.ts'],
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@core/(.*)$': '<rootDir>/src/core/$1',
        '^@player/(.*)$': '<rootDir>/src/player/$1',
        '^@enemy/(.*)$': '<rootDir>/src/enemy/$1',
        '^@weapon/(.*)$': '<rootDir>/src/weapon/$1',
        '^@ui/(.*)$': '<rootDir>/src/ui/$1',
        '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    },
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
