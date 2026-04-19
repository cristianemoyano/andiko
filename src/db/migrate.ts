import { umzug } from '../lib/migrations'

const command = process.argv[2]

async function run() {
  switch (command) {
    case 'up':
      await umzug.up()
      break
    case 'down':
      await umzug.down()
      break
    case 'status':
      const pending = await umzug.pending()
      const executed = await umzug.executed()
      console.log('Executed:', executed.map((m) => m.name))
      console.log('Pending:', pending.map((m) => m.name))
      break
    default:
      console.error('Usage: migrate <up|down|status>')
      process.exit(1)
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
