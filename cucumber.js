module.exports = {
  default: {
    require: [
      'tests/integration/steps/**/*.ts',
      'tests/integration/support/**/*.ts',
    ],
    requireModule: ['ts-node/register'],
    format: [
      'progress',
      'html:test-results/cucumber-report.html',
      'json:test-results/cucumber-report.json',
      'junit:test-results/cucumber-report.xml',
    ],
    formatOptions: {
      snippetInterface: 'async-await',
    },
    parallel: 2,
    order: 'defined',
    strict: true,
    dryRun: false,
    failFast: false,
    worldParameters: {
      baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
      headless: process.env.HEADLESS !== 'false',
    },
  },

  watch: {
    require: [
      'tests/integration/steps/**/*.ts',
      'tests/integration/support/**/*.ts',
    ],
    requireModule: ['ts-node/register'],
    format: ['progress'],
    parallel: 1,
    watch: true,
  },

  ci: {
    require: [
      'tests/integration/steps/**/*.ts',
      'tests/integration/support/**/*.ts',
    ],
    requireModule: ['ts-node/register'],
    format: [
      'progress',
      'html:test-results/cucumber-report.html',
      'json:test-results/cucumber-report.json',
      'junit:test-results/cucumber-report.xml',
    ],
    parallel: 4,
    strict: true,
    failFast: false,
  },
}
