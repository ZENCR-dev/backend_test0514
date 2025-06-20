module.exports = {
  displayName: 'API Contract Tests',
  testMatch: ['<rootDir>/**/*.spec.ts'],
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  testTimeout: 20000, // 20秒超时
  verbose: true,
  collectCoverage: false,
  maxWorkers: 1, // 串行执行避免API请求冲突
  forceExit: true,
  detectOpenHandles: true,
  rootDir: '.',
  roots: ['<rootDir>']
}; 