import { QueryTypes } from 'sequelize'
import sequelize from '@/lib/db'

function printUsage(): never {
  console.error('Usage:')
  console.error('  pnpm db:clear-login-throttle -- <email>')
  console.error('  pnpm db:clear-login-throttle -- --all')
  console.error('')
  console.error('Examples:')
  console.error('  pnpm db:clear-login-throttle -- admin@andiko.local')
  console.error('  LOGIN_EMAIL=admin@demo.local pnpm db:clear-login-throttle')
  process.exit(1)
}

function loginThrottleKey(email: string): string {
  return `login:${email.trim().toLowerCase()}`
}

function parseArgs(): { mode: 'email'; email: string } | { mode: 'all' } {
  const args = process.argv.slice(2).filter(a => a !== '--')
  if (args.includes('--all')) {
    return { mode: 'all' }
  }

  const email = args[0] ?? process.env.LOGIN_EMAIL?.trim()
  if (!email) printUsage()
  return { mode: 'email', email }
}

async function run() {
  const parsed = parseArgs()

  if (parsed.mode === 'all') {
    const rows = await sequelize.query<{ throttle_key: string }>(
      `DELETE FROM auth_throttles WHERE throttle_key LIKE 'login:%' RETURNING throttle_key`,
      { type: QueryTypes.SELECT },
    )
    if (rows.length === 0) {
      console.log('No login throttles to clear.')
      return
    }
    for (const row of rows) {
      console.log(`Cleared: ${row.throttle_key}`)
    }
    console.log(`Done. ${rows.length} login throttle(s) cleared.`)
    return
  }

  const key = loginThrottleKey(parsed.email)
  const rows = await sequelize.query<{ throttle_key: string }>(
    `DELETE FROM auth_throttles WHERE throttle_key = :key RETURNING throttle_key`,
    { replacements: { key }, type: QueryTypes.SELECT },
  )
  if (rows.length === 0) {
    console.log(`No active throttle for ${parsed.email}`)
    return
  }
  console.log(`Login throttle cleared for ${parsed.email}`)
}

run()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => sequelize.close())
