import sequelize from '@/lib/db'
import { QueryTypes } from 'sequelize'

function maskDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.password = parsed.password ? '***' : ''
    return parsed.toString()
  } catch {
    return '(invalid DATABASE_URL)'
  }
}

async function run() {
  if (process.env.ALLOW_PROD_RESET !== 'yes') {
    throw new Error(
      'Refusing to reset production database without ALLOW_PROD_RESET=yes. This drops ALL data in public schema.',
    )
  }

  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is empty. Set it in .env.production.local before running pnpm db:reset-prod.',
    )
  }

  console.warn(`⚠️  Resetting production database: ${maskDatabaseUrl(databaseUrl)}`)

  await sequelize.query('DROP SCHEMA public CASCADE;')
  await sequelize.query('CREATE SCHEMA public;')
  await sequelize.query('GRANT ALL ON SCHEMA public TO PUBLIC;')

  const ownerRows = await sequelize.query<{ current_user: string }>(
    'SELECT current_user',
    { type: QueryTypes.SELECT },
  )
  const owner = ownerRows[0]?.current_user
  if (owner) {
    await sequelize.query(`GRANT ALL ON SCHEMA public TO "${owner}";`)
  }

  console.log('Production database reset complete (public schema recreated).')
}

run()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => sequelize.close())
