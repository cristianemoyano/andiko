module.exports = {
  default: {
    paths: ['tests/integration/features/**/*.feature'],
    require: [
      'tests/integration/steps/**/*.ts',
      'tests/integration/support/**/*.ts',
    ],
    requireModule: ['tsx/cjs'],
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

  auth: {
    paths: ['tests/integration/features/auth.feature'],
    require: [
      'tests/integration/steps/**/*.ts',
      'tests/integration/support/**/*.ts',
    ],
    requireModule: ['tsx/cjs'],
    format: ['progress'],
    parallel: 1,
    strict: true,
    worldParameters: {
      baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
      headless: process.env.HEADLESS !== 'false',
    },
  },

  catalog: {
    paths: ['tests/integration/features/catalog.feature'],
    require: [
      'tests/integration/steps/**/*.ts',
      'tests/integration/support/**/*.ts',
    ],
    requireModule: ['tsx/cjs'],
    format: ['progress'],
    parallel: 1,
    strict: true,
    worldParameters: {
      baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
      headless: process.env.HEADLESS !== 'false',
    },
  },

  contacts: {
    paths: ['tests/integration/features/contacts.feature'],
    require: [
      'tests/integration/steps/**/*.ts',
      'tests/integration/support/**/*.ts',
    ],
    requireModule: ['tsx/cjs'],
    format: ['progress'],
    parallel: 1,
    strict: true,
    worldParameters: {
      baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
      headless: process.env.HEADLESS !== 'false',
    },
  },

  financials: {
    paths: ['tests/integration/features/financials.feature'],
    require: [
      'tests/integration/steps/**/*.ts',
      'tests/integration/support/**/*.ts',
    ],
    requireModule: ['tsx/cjs'],
    format: ['progress'],
    parallel: 1,
    strict: true,
    worldParameters: {
      baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
      headless: process.env.HEADLESS !== 'false',
    },
  },

  purchases: {
    paths: ['tests/integration/features/purchases.feature'],
    require: [
      'tests/integration/steps/**/*.ts',
      'tests/integration/support/**/*.ts',
    ],
    requireModule: ['tsx/cjs'],
    format: ['progress'],
    parallel: 1,
    strict: true,
    worldParameters: {
      baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
      headless: process.env.HEADLESS !== 'false',
    },
  },

  headed: {
    paths: ['tests/integration/features/**/*.feature'],
    require: [
      'tests/integration/steps/**/*.ts',
      'tests/integration/support/**/*.ts',
    ],
    requireModule: ['tsx/cjs'],
    format: ['progress'],
    parallel: 1,
    order: 'defined',
    strict: true,
    worldParameters: {
      baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
      headless: false,
    },
  },

  watch: {
    paths: ['tests/integration/features/**/*.feature'],
    require: [
      'tests/integration/steps/**/*.ts',
      'tests/integration/support/**/*.ts',
    ],
    requireModule: ['tsx/cjs'],
    format: ['progress'],
    parallel: 1,
    watch: true,
  },

  ci: {
    paths: ['tests/integration/features/**/*.feature'],
    require: [
      'tests/integration/steps/**/*.ts',
      'tests/integration/support/**/*.ts',
    ],
    requireModule: ['tsx/cjs'],
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
