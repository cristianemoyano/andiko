import { Umzug, SequelizeStorage } from 'umzug'
import sequelize from './db'

export const umzug = new Umzug({
  migrations: {
    glob: 'src/db/migrations/*.ts',
    resolve: ({ name, path, context }) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const migration = require(path!)
      return {
        name,
        up: async () => migration.up(context, sequelize.constructor),
        down: async () => migration.down(context, sequelize.constructor),
      }
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
})

export type Migration = typeof umzug._types.migration
