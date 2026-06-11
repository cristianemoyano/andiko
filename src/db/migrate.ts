import { umzug } from '../lib/migrations'
import sequelize from '../lib/db'

const command = process.argv[2]

async function run() {
  switch (command) {
    case 'up':
      await umzug.up()
      break
    case 'down':
      await umzug.down()
      break
    case 'status': {
      const pending = await umzug.pending()
      const executed = await umzug.executed()
      console.log('Executed:', executed.map((m) => m.name))
      console.log('Pending:', pending.map((m) => m.name))
      break
    }
    case 'baseline': {
      if (process.env.ALLOW_PROD_BASELINE !== 'yes') {
        throw new Error(
          'Refusing to baseline without ALLOW_PROD_BASELINE=yes. Use only when the schema already exists but sequelize_meta is empty.',
        )
      }
      const pending = await umzug.pending()
      if (pending.length === 0) {
        console.log('No pending migrations — nothing to baseline.')
        break
      }
      console.warn(`Baselining ${pending.length} migration(s) without running SQL…`)
      for (const migration of pending) {
        await sequelize.query('INSERT INTO sequelize_meta (name) VALUES (:name)', {
          replacements: { name: migration.name },
        })
        console.log(`  stamped: ${migration.name}`)
      }
      console.log('Baseline complete.')
      break
    }
    default:
      console.error('Usage: migrate <up|down|status|baseline>')
      process.exit(1)
  }
}

run()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => sequelize.close())
